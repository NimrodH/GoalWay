import { useState, useEffect, useRef } from "react";
import { data, redirect, Link, useNavigate, useLocation, useFetcher } from "react-router";
import type { Route } from "./+types/he.missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown, GitBranch, StickyNote, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import homeStyles from "./home.module.css";
import previewStyles from "./he.missions.$missionId.module.css";
import { getMissionByIdHe, getAllMissionsHe, checkMissionAccess } from "~/services/missions.server";
import { getInstructionsByIdsHe } from "~/services/instructions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import type { Instruction } from "~/data/instructions-he";

export function meta({ data }: Route.MetaArgs) {
  const mission = data?.mission;
  return [
    { title: mission ? `${mission.title} - משימות` : "משימה לא נמצאה" },
    {
      name: "description",
      content: mission?.description || "פרטי משימה",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const mission = await getMissionByIdHe(params.missionId);
  const allMissions = await getAllMissionsHe();

  if (!mission) {
    throw data("משימה לא נמצאה", { status: 404 });
  }

  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "true";

  if (!isPreview) {
    const profile = await getUserProfile(request);
    const userIsAdmin = isAdmin(profile);
    if (!userIsAdmin) {
      const hasAccess = await checkMissionAccess(params.missionId, profile?.organization_id ?? null);
      if (!hasAccess) {
        throw redirect("/unauthorized");
      }
    }
  }

  // Strip duplicate-occurrence suffixes (#2, #3, …) and de-duplicate before querying the DB.
  const rawIds = mission.instructions.map(([id]) => id);
  const uniqueBaseIds = [...new Set(rawIds.map((id) => (id.includes("#") ? id.split("#")[0] : id)))];
  const instructions = await getInstructionsByIdsHe(uniqueBaseIds);

  // Load admin notes only in preview mode (admin context)
  let adminNotes: string[] = [];
  if (isPreview) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
    const { data: row } = await supabase
      .from("missions")
      .select("admin_notes")
      .eq("id", params.missionId)
      .single();
    adminNotes = Array.isArray(row?.admin_notes) ? row.admin_notes : [];
  }

  return { mission, instructions, allMissions, isPreview, adminNotes };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "saveMissionAdminNote") {
    const notesJson = formData.get("notes") as string;
    let notes: string[];
    try {
      const parsed = JSON.parse(notesJson);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      notes = parsed;
    } catch {
      return { success: false, error: "Invalid notes format" };
    }
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_PROJECT_URL!,
        process.env.SUPABASE_API_KEY!,
      );
      const { error } = await supabase
        .from("missions")
        .update({ admin_notes: notes })
        .eq("id", params.missionId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  return { success: false, error: "Unknown action" };
}

export default function HeMissionPage({ loaderData }: Route.ComponentProps) {
  const { mission, instructions, allMissions, isPreview, adminNotes: initialAdminNotes } = loaderData;

  // Map instructions to maintain order from mission.instructions and apply custom titles
  // IF entries are special conditional blocks; END-IF and ELSE are structural markers
  const missionInstructions = mission.instructions.map(([id, customTitle]) => {
    if (id.startsWith("comment-") || id === "0") {
      return { id, title: customTitle || "", description: "", status: "comment" as const, type: "comment" as const, explanation: [] as [] };
    }
    if (id.startsWith("if-")) {
      return { id, title: customTitle || "IF", description: "", status: "if" as const, type: "if" as const, explanation: [] as [] };
    }
    if (id.startsWith("end-if-")) {
      return { id, title: "", description: "", status: "end-if" as const, type: "end-if" as const, explanation: [] as [] };
    }
    if (id.startsWith("else-")) {
      return { id, title: customTitle || "ELSE", description: "", status: "else" as const, type: "else" as const, explanation: [] as [] };
    }
    // Strip the duplicate-occurrence suffix (#2, #3, …) for DB lookup,
    // but keep the full entry key as `id` for independent selection state.
    const baseId = id.includes("#") ? id.split("#")[0] : id;
    const instruction = instructions.find(inst => inst.id === baseId);
    if (!instruction) return null;
    const resolved = customTitle ? { ...instruction, title: customTitle } : instruction;
    return id !== baseId ? { ...resolved, id } : resolved;
  }).filter(Boolean) as (typeof instructions[number] | { id: string; title: string; description: string; status: "comment"; type: "comment"; explanation: [] } | { id: string; title: string; description: string; status: "if"; type: "if"; explanation: [] } | { id: string; title: string; description: string; status: "end-if"; type: "end-if"; explanation: [] } | { id: string; title: string; description: string; status: "else"; type: "else"; explanation: [] })[];

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  // Map<ifId, 'if' | 'else'> — tracks which branch is active (missing = collapsed)
  const [expandedIfBlocks, setExpandedIfBlocks] = useState<Map<string, "if" | "else">>(new Map());

  // Build nested IF/ELSE structure using a stack-based parser.
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const elseChildrenOf = new Map<string, string[]>();
  const elseIdOf = new Map<string, string>(); // ifId -> elseId
  const depthOf = new Map<string, number>();
  (() => {
    const stack: string[] = [];
    const inElseBranch = new Set<string>();
    for (const [id] of mission.instructions) {
      if (id.startsWith("if-")) {
        const depth = stack.length;
        depthOf.set(id, depth);
        if (stack.length > 0) {
          const parentId = stack[stack.length - 1];
          parentOf.set(id, parentId);
          if (inElseBranch.has(parentId)) {
            const siblings = elseChildrenOf.get(parentId) ?? [];
            siblings.push(id);
            elseChildrenOf.set(parentId, siblings);
          } else {
            const siblings = childrenOf.get(parentId) ?? [];
            siblings.push(id);
            childrenOf.set(parentId, siblings);
          }
        }
        childrenOf.set(id, childrenOf.get(id) ?? []);
        elseChildrenOf.set(id, elseChildrenOf.get(id) ?? []);
        stack.push(id);
      } else if (id.startsWith("else-")) {
        if (stack.length > 0) {
          const ifId = stack[stack.length - 1];
          inElseBranch.add(ifId);
          elseIdOf.set(ifId, id);
          parentOf.set(id, ifId);
          const siblings = childrenOf.get(ifId) ?? [];
          siblings.push(id);
          childrenOf.set(ifId, siblings);
        }
      } else if (id.startsWith("end-if-")) {
        const closed = stack.pop();
        if (closed) inElseBranch.delete(closed);
      } else if (stack.length > 0) {
        const parentId = stack[stack.length - 1];
        parentOf.set(id, parentId);
        if (inElseBranch.has(parentId)) {
          const siblings = elseChildrenOf.get(parentId) ?? [];
          siblings.push(id);
          elseChildrenOf.set(parentId, siblings);
        } else {
          const siblings = childrenOf.get(parentId) ?? [];
          siblings.push(id);
          childrenOf.set(parentId, siblings);
        }
      }
    }
  })();

  /**
   * Collect all nested IF IDs (direct and transitive) inside a given IF block,
   * across both its IF-branch children and ELSE-branch children.
   */
  const collectDescendantIfIds = (ifId: string): string[] => {
    const result: string[] = [];
    const queue = [
      ...(childrenOf.get(ifId) ?? []),
      ...(elseChildrenOf.get(ifId) ?? []),
    ];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (id.startsWith("if-")) {
        result.push(id);
        queue.push(...(childrenOf.get(id) ?? []));
        queue.push(...(elseChildrenOf.get(id) ?? []));
      }
    }
    return result;
  };

  /**
   * Toggle IF block. branch = 'if' | 'else'.
   * Clicking the active branch collapses it; clicking the other switches to it.
   * In both cases, any nested IF blocks that were previously expanded are collapsed.
   */
  const toggleIfBlock = (ifId: string, branch: "if" | "else" = "if") => {
    setExpandedIfBlocks(prev => {
      const next = new Map(prev);
      const isCollapsing = next.get(ifId) === branch;

      if (isCollapsing) {
        next.delete(ifId);
      } else {
        next.set(ifId, branch);
      }

      // In either case, collapse all nested IF blocks inside this one
      for (const descendantId of collectDescendantIfIds(ifId)) {
        next.delete(descendantId);
      }

      return next;
    });
  };

  // An item is hidden when its parent IF is collapsed or it's in the non-active branch.
  const hiddenByIf = new Set<string>();
  for (const [ifId, children] of childrenOf) {
    const activeBranch = expandedIfBlocks.get(ifId);
    if (!activeBranch) {
      for (const id of children) hiddenByIf.add(id);
      for (const id of elseChildrenOf.get(ifId) ?? []) hiddenByIf.add(id);
    } else if (activeBranch === "if") {
      for (const id of elseChildrenOf.get(ifId) ?? []) hiddenByIf.add(id);
    } else {
      for (const id of children) {
        const elseId = elseIdOf.get(ifId);
        if (id !== elseId) hiddenByIf.add(id);
      }
    }
  }
  const [expandedLinkInstructions, setExpandedLinkInstructions] = useState<Map<string, Instruction[]>>(new Map());
  const [loadingLinkInstructions, setLoadingLinkInstructions] = useState<Set<string>>(new Set());

  // ── Admin notes panel state (preview mode only) ──────────────────────────
  const [notesOpen, setNotesOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState<string[]>(initialAdminNotes ?? []);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const adminNotesFetcher = useFetcher<{ success: boolean; error?: string }>();
  const newNoteInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingSaveRef = useRef<string[] | null>(null);

  // Sync local adminNotes from loader data after each route revalidation,
  // but only when there is no in-flight save (to avoid overwriting optimistic state).
  useEffect(() => {
    if (adminNotesFetcher.state === "idle" && pendingSaveRef.current === null) {
      setAdminNotes(initialAdminNotes ?? []);
    }
  }, [initialAdminNotes]);

  useEffect(() => {
    if (adminNotesFetcher.state === "idle" && pendingSaveRef.current !== null) {
      pendingSaveRef.current = null;
    }
  }, [adminNotesFetcher.state]);

  const saveAdminNotes = (notes: string[]) => {
    pendingSaveRef.current = notes;
    const fd = new FormData();
    fd.set("actionType", "saveMissionAdminNote");
    fd.set("notes", JSON.stringify(notes));
    adminNotesFetcher.submit(fd, { method: "post", action: `/he/missions/${params.missionId}` });
  };

  const handleAddNote = () => {
    const trimmed = newNoteText.trim();
    if (!trimmed) return;
    const updated = [...adminNotes, trimmed];
    setAdminNotes(updated);
    setNewNoteText("");
    saveAdminNotes(updated);
  };

  const handleRemoveNote = (idx: number) => {
    const updated = adminNotes.filter((_, i) => i !== idx);
    setAdminNotes(updated);
    saveAdminNotes(updated);
  };

  const handleStartEdit = (idx: number) => {
    setEditingNoteIndex(idx);
    setEditingNoteText(adminNotes[idx]);
  };

  const handleSaveEdit = () => {
    if (editingNoteIndex === null) return;
    const trimmed = editingNoteText.trim();
    if (!trimmed) return;
    const updated = adminNotes.map((n, i) => (i === editingNoteIndex ? trimmed : n));
    setAdminNotes(updated);
    setEditingNoteIndex(null);
    setEditingNoteText("");
    saveAdminNotes(updated);
  };

  const handleCancelEdit = () => {
    setEditingNoteIndex(null);
    setEditingNoteText("");
  };
  // ─────────────────────────────────────────────────────────────────────────

  const navigate = useNavigate();
  const location = useLocation();

  // Access params from loaderData (missionId is available via mission)
  const params = { missionId: mission.id };

  // Get the previous mission from location state or default to home
  const previousMissionId = (location.state as { from?: string })?.from;

  const handleLinkInstructionClick = async (instructionId: string, linkedMissionId: string) => {
    if (expandedLinkInstructions.has(instructionId)) {
      const newMap = new Map(expandedLinkInstructions);
      newMap.delete(instructionId);
      setExpandedLinkInstructions(newMap);
    } else {
      setLoadingLinkInstructions(new Set([...loadingLinkInstructions, instructionId]));
      try {
        const response = await fetch(`/api/he/missions/${linkedMissionId}`);
        if (!response.ok) {
          console.error("Failed to fetch linked mission");
          return;
        }
        const linkedMissionData = await response.json();
        const linkedMission = linkedMissionData.mission;
        const linkedInstructions = linkedMissionData.instructions;
        const linkedMissionInstructions = linkedMission.instructions.map(([id, customTitle]: [string, string?]) => {
          const instruction = linkedInstructions.find((inst: Instruction) => inst.id === id);
          if (!instruction) return null;
          return customTitle ? { ...instruction, title: customTitle } : instruction;
        }).filter(Boolean) as Instruction[];
        const newMap = new Map(expandedLinkInstructions);
        newMap.set(instructionId, linkedMissionInstructions);
        setExpandedLinkInstructions(newMap);
      } catch (error) {
        console.error("Error fetching linked mission:", error);
      } finally {
        const newLoading = new Set(loadingLinkInstructions);
        newLoading.delete(instructionId);
        setLoadingLinkInstructions(newLoading);
      }
    }
  };

  const handleInstructionClick = (instructionId: string, event?: React.MouseEvent) => {
    const instruction = missionInstructions.find((inst) => inst?.id === instructionId);

    if (event?.shiftKey) {
      navigate(`/admin/instructions?instructionId=${instructionId}`);
      return;
    }

    // IF block toggle
    if (instruction && "type" in instruction && instruction.type === "if") {
      toggleIfBlock(instructionId, "if");
      return;
    }

    if (instruction && "type" in instruction && instruction.type === "link" && "missionId" in instruction && instruction.missionId) {
      handleLinkInstructionClick(instructionId, instruction.missionId as string);
      return;
    }

    if (selectedInstructionId === instructionId) {
      setSelectedInstructionId(null);
    } else {
      setSelectedInstructionId(instructionId);
    }
  };

  const handleBackClick = () => {
    if (previousMissionId) {
      navigate(`/he/missions/${previousMissionId}`);
    } else {
      navigate("/he");
    }
  };

  const selectedInstruction = missionInstructions.find((inst) => inst?.id === selectedInstructionId) || null;

  return (
    <>
      {isPreview && (
        <>
          {/* Preview bar */}
          <div className={previewStyles.previewBar}>
            <button
              onClick={() => navigate(`/admin/missions?missionId=${mission.id}`)}
              className={previewStyles.menuLink}
            >
              <ArrowLeft size={18} />
              חזור לניהול
            </button>

            {/* Notes toggle button */}
            <button
              className={`${previewStyles.menuLink} ${notesOpen ? previewStyles.menuLinkActive : ""}`}
              onClick={() => {
                setNotesOpen((v) => !v);
                if (!notesOpen) {
                  setTimeout(() => newNoteInputRef.current?.focus(), 80);
                }
              }}
              aria-pressed={notesOpen}
              title="הצג / הסתר הערות מחבר למשימה זו"
            >
              <StickyNote size={15} />
              הערות
              {adminNotes.length > 0 && (
                <span className={previewStyles.notesBadge}>{adminNotes.length}</span>
              )}
            </button>
          </div>

          {/* Admin notes panel — shown below the preview bar */}
          {notesOpen && (
            <div className={previewStyles.notesPanel}>
              <div className={previewStyles.notesPanelHeader}>
                <span className={previewStyles.notesPanelTitle}>
                  <StickyNote size={14} /> הערות מחבר
                  {adminNotes.length > 0 && ` (${adminNotes.length})`}
                </span>
                {adminNotesFetcher.state !== "idle" && (
                  <span className={previewStyles.statusSaving}>שומר…</span>
                )}
                {adminNotesFetcher.state === "idle" && adminNotesFetcher.data?.success === true && (
                  <span className={previewStyles.statusSaved}>✓ נשמר</span>
                )}
              </div>

              {/* Existing notes */}
              {adminNotes.length > 0 && (
                <ul className={previewStyles.notesList}>
                  {adminNotes.map((note, idx) => (
                    <li key={idx} className={previewStyles.noteItem}>
                      {editingNoteIndex === idx ? (
                        <div className={previewStyles.noteEditRow}>
                          <textarea
                            className={previewStyles.noteTextarea}
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                          <div className={previewStyles.noteEditActions}>
                            <button
                              className={previewStyles.noteActionBtn}
                              onClick={handleSaveEdit}
                              disabled={!editingNoteText.trim()}
                              title="שמור"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className={previewStyles.noteActionBtn}
                              onClick={handleCancelEdit}
                              title="בטל"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={previewStyles.noteViewRow}>
                          <span className={previewStyles.noteText}>{note}</span>
                          <div className={previewStyles.noteViewActions}>
                            <button
                              className={previewStyles.noteActionBtn}
                              onClick={() => handleStartEdit(idx)}
                              title="ערוך הערה"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className={`${previewStyles.noteActionBtn} ${previewStyles.noteDeleteBtn}`}
                              onClick={() => handleRemoveNote(idx)}
                              title="מחק הערה"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {adminNotes.length === 0 && (
                <p className={previewStyles.notesEmpty}>אין הערות עדיין. הוסף את הראשונה למטה.</p>
              )}

              {/* New note input */}
              <div className={previewStyles.notesAddRow}>
                <textarea
                  ref={newNoteInputRef}
                  className={previewStyles.noteTextarea}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="הוסף הערה… (Ctrl+Enter לשמירה)"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                <button
                  className={previewStyles.notesAddBtn}
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim()}
                  title="הוסף הערה"
                >
                  <Plus size={16} />
                  הוסף
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className={homeStyles.container} dir="rtl">
        <section className={homeStyles.instructionListSection}>
          <div className={homeStyles.headerWrapper}>
            {previousMissionId && (
              <button onClick={handleBackClick} className={homeStyles.menuLink}>
                <ArrowLeft size={18} />
                חזור למשימה הקודמת
              </button>
            )}
            <h1 className={homeStyles.sectionHeader}>{mission.title}</h1>
            <Link to="/he" className={homeStyles.menuLink}>
              <BookOpen size={18} />
              צפה בכל המשימות
            </Link>
          </div>
          <p className={homeStyles.missionDescription}>{mission.description}</p>
          <div className={homeStyles.instructionList}>
            {missionInstructions.map((instruction) => {
              if (hiddenByIf.has(instruction.id)) return null;

              const isComment = "type" in instruction && instruction.type === "comment";
              const isIf = "type" in instruction && instruction.type === "if";
              const isEndIf = "type" in instruction && instruction.type === "end-if";
              const isElse = "type" in instruction && instruction.type === "else";
              const activeBranch = isIf ? expandedIfBlocks.get(instruction.id) : undefined;
              const isIfExpanded = isIf && activeBranch !== undefined;
              const isLinkExpanded = expandedLinkInstructions.has(instruction.id);
              const isLoading = loadingLinkInstructions.has(instruction.id);
              const expandedInstructions = expandedLinkInstructions.get(instruction.id);

              // ELSE separator rows are rendered inline within the IF row, not standalone
              if (isElse) return null;

              // Render END-IF divider only when its matching IF block is expanded
              if (isEndIf) {
                const matchingIfId = instruction.id.replace(/^end-if-/, "if-");
                if (!expandedIfBlocks.get(matchingIfId)) return null;
                return (
                  <div
                    key={instruction.id}
                    style={{
                      height: "2px",
                      background: "linear-gradient(to left, transparent, var(--color-success-8) 20%, var(--color-success-8) 80%, transparent)",
                      borderRadius: "9999px",
                      margin: "var(--space-2) var(--space-3)",
                      opacity: 0.7,
                    }}
                    aria-hidden="true"
                  />
                );
              }

              if (isComment) {
                return (
                  <div key={instruction.id} className={homeStyles.instructionItem}>
                    <div style={{ display: "flex", alignItems: "center", padding: "var(--space-3) var(--space-4)", color: "var(--color-accent-11)", fontStyle: "italic", fontSize: "0.9rem", opacity: 0.8 }}>
                      <span style={{ marginLeft: "var(--space-2)", flexShrink: 0 }}>💬</span>
                      {instruction.title}
                    </div>
                  </div>
                );
              }

              if (isIf) {
                const depth = depthOf.get(instruction.id) ?? 0;
                const elseId = elseIdOf.get(instruction.id);
                const hasElse = Boolean(elseId);
                const elseEntry = hasElse
                  ? missionInstructions.find((m) => m && "type" in m && m.type === "else" && m.id === elseId)
                  : null;
                const elseTitle = elseEntry && "title" in elseEntry ? elseEntry.title : "ELSE";

                const ifBtnStyle = {
                  display: "flex", alignItems: "center", gap: "var(--space-2)",
                  flex: hasElse ? 1 : undefined,
                  width: hasElse ? undefined : "100%",
                  minWidth: 0,
                  padding: depth > 0 ? "var(--space-2) var(--space-3)" : "var(--space-3) var(--space-4)",
                  background: activeBranch === "if" ? "var(--color-success-4)" : (depth > 0 ? "var(--color-success-2)" : "var(--color-success-3)"),
                  border: `1px solid ${activeBranch === "if" ? "var(--color-success-8)" : (depth > 0 ? "var(--color-success-6)" : "var(--color-success-7)")}`,
                  borderRadius: "var(--radius-2)", color: "var(--color-success-11)",
                  fontFamily: "var(--font-body)",
                  fontSize: depth > 0 ? "0.875rem" : "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer", textAlign: "right" as const, marginBottom: hasElse ? 0 : "var(--space-1)",
                  opacity: depth > 0 ? 0.92 : 1,
                };

                const elseBtnStyle = {
                  display: "flex", alignItems: "center", gap: "var(--space-2)",
                  flex: 1,
                  minWidth: 0,
                  padding: depth > 0 ? "var(--space-2) var(--space-3)" : "var(--space-3) var(--space-4)",
                  background: activeBranch === "else" ? "var(--color-amber-4)" : (depth > 0 ? "var(--color-amber-2)" : "var(--color-amber-3)"),
                  border: `1px solid ${activeBranch === "else" ? "var(--color-amber-8)" : (depth > 0 ? "var(--color-amber-6)" : "var(--color-amber-7)")}`,
                  borderRadius: "var(--radius-2)", color: "var(--color-amber-11)",
                  fontFamily: "var(--font-body)",
                  fontSize: depth > 0 ? "0.875rem" : "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer", textAlign: "right" as const, marginBottom: 0,
                  opacity: depth > 0 ? 0.92 : 1,
                };

                return (
                  <div
                    key={instruction.id}
                    className={homeStyles.instructionItem}
                    style={depth > 0 ? { paddingRight: `calc(${depth} * var(--space-5))` } : undefined}
                  >
                    {hasElse ? (
                      <div style={{ display: "flex", gap: "4px", marginBottom: "var(--space-1)" }}>
                        <button
                          onClick={() => toggleIfBlock(instruction.id, "if")}
                          style={ifBtnStyle}
                          aria-expanded={activeBranch === "if"}
                        >
                          <GitBranch size={depth > 0 ? 15 : 18} style={{ flexShrink: 0, color: "var(--color-success-9)" }} />
                          <span style={{ flex: 1 }}>{instruction.title}</span>
                          {activeBranch === "if" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                          onClick={() => toggleIfBlock(instruction.id, "else")}
                          style={elseBtnStyle}
                          aria-expanded={activeBranch === "else"}
                        >
                          <GitBranch size={depth > 0 ? 15 : 18} style={{ flexShrink: 0, color: "var(--color-amber-9)" }} />
                          <span style={{ flex: 1 }}>{elseTitle}</span>
                          {activeBranch === "else" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleIfBlock(instruction.id, "if")}
                        style={ifBtnStyle}
                        aria-expanded={isIfExpanded}
                      >
                        <GitBranch size={depth > 0 ? 15 : 18} style={{ flexShrink: 0, color: "var(--color-success-9)" }} />
                        <span style={{ flex: 1 }}>{instruction.title}</span>
                        {isIfExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                );
              }

              const instrDepth = (() => {
                let p = parentOf.get(instruction.id);
                let d = 0;
                while (p) { d++; p = parentOf.get(p); }
                return d;
              })();

              return (
                <div
                  key={instruction.id}
                  style={instrDepth > 0 ? { paddingRight: `calc(${instrDepth} * var(--space-5))` } : undefined}
                >
                  <div className={homeStyles.instructionItem}>
                    <InstructionListItem
                      title={instruction.title}
                      description={instruction.description}
                      selected={selectedInstructionId === instruction.id}
                      onClick={(event) => handleInstructionClick(instruction.id, event)}
                    />
                    {"type" in instruction && instruction.type === "link" && (
                      <div style={{ marginRight: "1rem", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
                        {isLoading ? "טוען..." : (isLinkExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                      </div>
                    )}
                    {selectedInstructionId === instruction.id && (
                      <div className={homeStyles.mobileExplanation}>
                        <ExplanationDisplay instruction={instruction as Instruction} />
                      </div>
                    )}
                  </div>

                  {isLinkExpanded && expandedInstructions && (
                    <div style={{ marginRight: "2rem", marginTop: "0.5rem", marginBottom: "1rem" }}>
                      {expandedInstructions.map((linkedInstruction) => (
                        <div key={linkedInstruction.id} className={homeStyles.instructionItem}>
                          <InstructionListItem
                            title={linkedInstruction.title}
                            description={linkedInstruction.description}
                            selected={selectedInstructionId === linkedInstruction.id}
                            onClick={(event) => {
                              if (event?.shiftKey) {
                                navigate(`/admin/instructions?instructionId=${linkedInstruction.id}`);
                                return;
                              }
                              if (selectedInstructionId === linkedInstruction.id) {
                                setSelectedInstructionId(null);
                              } else {
                                setSelectedInstructionId(linkedInstruction.id);
                              }
                            }}
                          />
                          {selectedInstructionId === linkedInstruction.id && linkedInstruction.type !== "link" && (
                            <div className={homeStyles.mobileExplanation}>
                              <ExplanationDisplay instruction={linkedInstruction} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={homeStyles.explanationSection}>
          <ExplanationDisplay
            instruction={
              selectedInstruction &&
              "status" in selectedInstruction &&
              (selectedInstruction.status === "comment" || selectedInstruction.status === "if" || selectedInstruction.status === "else")
                ? null
                : (selectedInstruction as Instruction | null)
            }
            className={homeStyles.explanationContainer}
          />
        </section>
      </div>
    </>
  );
}
