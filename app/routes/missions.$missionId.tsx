import { useState, useEffect } from "react";
import { data, redirect, Link, useNavigate, useLocation, useSearchParams, useFetcher } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { AdminNotesPanel } from "~/components/admin-notes-panel/admin-notes-panel";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown, List, ListX, GitBranch } from "lucide-react";
import styles from "./missions.$missionId.module.css";
import { getMissionById, getAllMissions, checkMissionAccess } from "~/services/missions.server";
import { getInstructionsByIds } from "~/services/instructions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import type { Instruction } from "~/data/instructions";

export function meta({ data }: Route.MetaArgs) {
  const mission = data?.mission;
  return [
    { title: mission ? `${mission.title} - Missions` : "Mission Not Found" },
    {
      name: "description",
      content: mission?.description || "Mission details",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const mission = await getMissionById(params.missionId);

  if (!mission) {
    throw data("Mission not found", { status: 404 });
  }

  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "true";

  // Preview mode bypasses all access checks — used by admins navigating from
  // the admin panel. No auth cookie is needed because the admin already
  // authenticated on the admin page in the same session.
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

  const allMissions = await getAllMissions();
  // Strip duplicate-occurrence suffixes (#2, #3, …) and de-duplicate before querying the DB.
  // The "#N" suffix is a UI convention that allows the same instruction to appear multiple times
  // in a mission with independent selection/completion state.
  const rawIds = mission.instructions.map(([id]) => id);
  const uniqueBaseIds = [...new Set(rawIds.map((id) => (id.includes("#") ? id.split("#")[0] : id)))];
  const instructions = await getInstructionsByIds(uniqueBaseIds);

  // Fetch admin_notes for the mission (only meaningful in preview/admin context)
  let adminNotes: string[] = [];
  if (isPreview) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_PROJECT_URL!,
      process.env.SUPABASE_API_KEY!,
    );
    const { data: row } = await supabase
      .from("missions")
      .select("admin_notes")
      .eq("id", params.missionId)
      .single();
    adminNotes = Array.isArray(row?.admin_notes) ? row.admin_notes : [];
  }

  return { mission, instructions, allMissions, isPreview, adminNotes };
}

type MissionStatus = "Hide" | "For all" | "Only Adama" | "Only Bazn";
type InstructionStatus = "only title" | "partial explanation" | "full explanation";

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "updateAdminNotes") {
    const missionId = formData.get("missionId") as string;
    const notesRaw = formData.get("notes") as string;
    if (!missionId) return { success: false, error: "Missing missionId" };
    let notes: string[];
    try {
      notes = JSON.parse(notesRaw);
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
        .eq("id", missionId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  if (actionType === "updateStatus") {
    const newStatus = formData.get("status") as MissionStatus;
    const validStatuses: MissionStatus[] = ["Hide", "For all", "Only Adama", "Only Bazn"];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, error: "Invalid status value" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_PROJECT_URL!,
        process.env.SUPABASE_API_KEY!,
      );

      // Fetch current data_en to merge the status update into it
      const { data: row, error: fetchError } = await supabase
        .from("missions")
        .select("data_en")
        .eq("id", params.missionId)
        .single();

      if (fetchError || !row?.data_en) {
        return { success: false, error: fetchError?.message || "Mission not found" };
      }

      const updatedDataEn = { ...row.data_en, status: newStatus };

      const { error } = await supabase
        .from("missions")
        .update({ data_en: updatedDataEn, updated_at: new Date().toISOString() })
        .eq("id", params.missionId);

      if (error) return { success: false, error: error.message };

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  if (actionType === "updateInstructionStatus") {
    const instructionId = formData.get("instructionId") as string;
    const newStatus = formData.get("status") as InstructionStatus;
    const validStatuses: InstructionStatus[] = ["only title", "partial explanation", "full explanation"];

    if (!instructionId || !validStatuses.includes(newStatus)) {
      return { success: false, error: "Invalid instructionId or status value" };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_PROJECT_URL!,
        process.env.SUPABASE_API_KEY!,
      );

      const { data: row, error: fetchError } = await supabase
        .from("instructions")
        .select("data_en")
        .eq("id", instructionId)
        .single();

      if (fetchError || !row?.data_en) {
        return { success: false, instructionId, error: fetchError?.message || "Instruction not found" };
      }

      const updatedDataEn = { ...row.data_en, status: newStatus };

      const { error } = await supabase
        .from("instructions")
        .update({ data_en: updatedDataEn, updated_at: new Date().toISOString() })
        .eq("id", instructionId);

      if (error) return { success: false, instructionId, error: error.message };

      return { success: true, instructionId };
    } catch (err) {
      return { success: false, instructionId, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  return { success: false, error: "Unknown action" };
}

type CommentEntry = {
  id: string;
  title: string;
  description: string;
  status: "comment";
  type: "comment";
  explanation: [];
};

type IfEntry = {
  id: string;
  title: string;
  description: string;
  status: "if";
  type: "if";
  explanation: [];
};

type EndIfEntry = {
  id: string;
  title: string;
  description: string;
  status: "end-if";
  type: "end-if";
  explanation: [];
};

type TempEntry = {
  id: string;
  title: string;
  description: string;
  status: "temp";
  type: "temp";
  explanation: [];
};

type MissionInstruction =
  | (typeof import("../services/instructions.server")["getInstructionsByIds"] extends (...args: any) => Promise<infer R> ? R : never)[number]
  | CommentEntry
  | IfEntry
  | EndIfEntry
  | TempEntry;

export default function MissionPage({ loaderData }: Route.ComponentProps) {
  const { mission, instructions, allMissions, isPreview, adminNotes } = loaderData;
  const statusFetcher = useFetcher();
  // Optimistic status — show the pending value immediately while saving
  const currentStatus = (statusFetcher.formData?.get("status") as MissionStatus | undefined) ?? mission.status ?? "For all";

  // Single shared fetcher for all instruction status updates
  const instrStatusFetcher = useFetcher<{ success: boolean; instructionId?: string; error?: string }>();
  // Optimistic instruction statuses — keyed by instruction ID
  const optimisticInstrStatus: Record<string, InstructionStatus> = {};
  if (instrStatusFetcher.formData?.get("actionType") === "updateInstructionStatus") {
    const id = instrStatusFetcher.formData.get("instructionId") as string;
    const st = instrStatusFetcher.formData.get("status") as InstructionStatus;
    if (id && st) optimisticInstrStatus[id] = st;
  }

  const getInstrStatus = (instruction: { id: string; status?: string }): InstructionStatus => {
    return (
      optimisticInstrStatus[instruction.id] ??
      (instruction.status as InstructionStatus | undefined) ??
      "only title"
    );
  };

  const submitInstrStatus = (instructionId: string, newStatus: InstructionStatus) => {
    const fd = new FormData();
    fd.set("actionType", "updateInstructionStatus");
    fd.set("instructionId", instructionId);
    fd.set("status", newStatus);
    instrStatusFetcher.submit(fd, { method: "post" });
  };

  // Build the flat list, skipping END-IF (hidden from end user)
  const missionInstructions = mission.instructions
    .map(([id, customTitle]) => {
      if (id.startsWith("comment-") || id === "0") {
        return {
          id,
          title: customTitle || "",
          description: "",
          status: "comment" as const,
          type: "comment" as const,
          explanation: [] as [],
        };
      }
      if (id.startsWith("if-")) {
        return {
          id,
          title: customTitle || "IF",
          description: "",
          status: "if" as const,
          type: "if" as const,
          explanation: [] as [],
        };
      }
      // END-IF renders as a thin green divider
      if (id.startsWith("end-if-")) {
        return {
          id,
          title: "",
          description: "",
          status: "end-if" as const,
          type: "end-if" as const,
          explanation: [] as [],
        };
      }
      // Temp instruction (T1, T2, ...) — not yet saved to DB, show as empty instruction
      if (/^T\d+$/.test(id)) {
        return {
          id,
          title: customTitle || id,
          description: "",
          status: "temp" as const,
          type: "temp" as const,
          explanation: [] as [],
        };
      }
      // Strip the duplicate-occurrence suffix (#2, #3, …) to get the real instruction ID,
      // but keep the full entry key as `id` so selection/completion state is independent.
      const baseId = id.includes("#") ? id.split("#")[0] : id;
      const instruction = instructions.find((inst) => inst.id === baseId);
      if (!instruction) return null;
      // Preserve the entry key (with suffix) as the id so duplicates track independently
      const resolvedInstruction = customTitle ? { ...instruction, title: customTitle } : instruction;
      return id !== baseId ? { ...resolvedInstruction, id } : resolvedInstruction;
    })
    .filter(Boolean) as (NonNullable<ReturnType<typeof instructions["find"]>> | CommentEntry | IfEntry | EndIfEntry | TempEntry)[];

  // Build map: ifId -> array of raw instruction IDs inside the block
  const ifBlockMap = (() => {
    const map = new Map<string, string[]>();
    let currentIfId: string | null = null;
    const inside: string[] = [];
    for (const [id] of mission.instructions) {
      if (id.startsWith("if-")) {
        currentIfId = id;
      } else if (id.startsWith("end-if-")) {
        if (currentIfId) {
          map.set(currentIfId, [...inside]);
          inside.length = 0;
          currentIfId = null;
        }
      } else if (currentIfId) {
        inside.push(id);
      }
    }
    // If there is no matching END-IF, still capture the block
    if (currentIfId) {
      map.set(currentIfId, [...inside]);
    }
    return map;
  })();

  const [captionVisible, setCaptionVisible] = useState(true);
  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  // Tracks selected instruction inside each expanded sub-mission, keyed by the parent link instruction id
  const [selectedLinkedInstructionId, setSelectedLinkedInstructionId] = useState<Map<string, string | null>>(new Map());
  const [expandedLinkInstructions, setExpandedLinkInstructions] = useState<Map<string, Instruction[]>>(new Map());
  const [loadingLinkInstructions, setLoadingLinkInstructions] = useState<Set<string>>(new Set());
  const [completedInstructions, setCompletedInstructions] = useState<Set<string>>(new Set());
  // Track which IF blocks the user has expanded
  const [expandedIfBlocks, setExpandedIfBlocks] = useState<Set<string>>(new Set());

  // Set of instruction IDs hidden inside a collapsed IF block
  const hiddenByIf = new Set<string>();
  for (const [ifId, ids] of ifBlockMap) {
    if (!expandedIfBlocks.has(ifId)) {
      for (const id of ids) hiddenByIf.add(id);
    }
  }

  const toggleIfBlock = (ifId: string) => {
    setExpandedIfBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(ifId)) {
        next.delete(ifId);
      } else {
        next.add(ifId);
      }
      return next;
    });
  };

  // Reset completion state when navigating away from the mission
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`completed-${mission.id}`);
      }
    };
  }, [mission.id]);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

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
        const response = await fetch(`/api/missions/${linkedMissionId}`);
        if (!response.ok) {
          console.error("Failed to fetch linked mission");
          return;
        }

        const linkedMissionData = await response.json();
        const linkedMission = linkedMissionData.mission;
        const linkedInstructions = linkedMissionData.instructions;

        const linkedMissionInstructions = linkedMission.instructions
          .map(([id, customTitle]: [string, string?]) => {
            const instruction = linkedInstructions.find((inst: Instruction) => inst.id === id);
            if (!instruction) return null;
            return customTitle ? { ...instruction, title: customTitle } : instruction;
          })
          .filter(Boolean) as Instruction[];

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

  const handleLinkedInstructionClick = (parentLinkId: string, linkedInstruction: Instruction, event?: React.MouseEvent) => {
    if (event?.shiftKey) {
      navigate(`/admin/instructions?instructionId=${linkedInstruction.id}`);
      return;
    }

    if (selectedInstructionId) {
      setCompletedInstructions((c) => new Set([...c, selectedInstructionId]));
      setSelectedInstructionId(null);
    }

    setSelectedLinkedInstructionId((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(parentLinkId);
      if (current === linkedInstruction.id) {
        newMap.set(parentLinkId, null);
        setCompletedInstructions((c) => new Set([...c, linkedInstruction.id]));
      } else {
        if (current) {
          setCompletedInstructions((c) => new Set([...c, current]));
        }
        newMap.set(parentLinkId, linkedInstruction.id);
      }
      return newMap;
    });
  };

  const handleInstructionClick = (instructionId: string, event?: React.MouseEvent) => {
    const instruction = missionInstructions.find((inst) => inst?.id === instructionId);

    if (event?.shiftKey) {
      navigate(`/admin/instructions?instructionId=${instructionId}`);
      return;
    }

    // IF block toggle
    if (instruction && "type" in instruction && instruction.type === "if") {
      toggleIfBlock(instructionId);
      return;
    }

    if (instruction && "type" in instruction && instruction.type === "link" && "missionId" in instruction && instruction.missionId) {
      handleLinkInstructionClick(instructionId, instruction.missionId as string);
      return;
    }

    if (selectedInstructionId === instructionId) {
      setSelectedInstructionId(null);
      setCompletedInstructions((prev) => new Set([...prev, instructionId]));
    } else {
      if (selectedInstructionId) {
        setCompletedInstructions((prev) => new Set([...prev, selectedInstructionId]));
      }
      setSelectedLinkedInstructionId((prev) => {
        const newMap = new Map(prev);
        for (const [key, val] of newMap) {
          if (val) {
            setCompletedInstructions((c) => new Set([...c, val]));
            newMap.set(key, null);
          }
        }
        return newMap;
      });
      setSelectedInstructionId(instructionId);
    }
  };

  const handleBackClick = () => {
    if (previousMissionId) {
      navigate(`/missions/${previousMissionId}`);
    } else {
      navigate("/");
    }
  };

  const selectedInstruction = missionInstructions.find((inst) => inst?.id === selectedInstructionId) || null;

  // Don't pass comments, IF, or temp entries to ExplanationDisplay
  const instructionToDisplay =
    selectedInstruction &&
    "type" in selectedInstruction &&
    (selectedInstruction.type === "comment" || selectedInstruction.type === "if" || selectedInstruction.type === "temp")
      ? null
      : selectedInstruction;

  // Scroll selected master-mission instruction to top after render
  useEffect(() => {
    if (selectedInstructionId) {
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-instruction-id="${selectedInstructionId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  }, [selectedInstructionId]);

  // Scroll selected sub-mission instruction to top after render
  useEffect(() => {
    for (const [parentId, linkedId] of selectedLinkedInstructionId) {
      if (linkedId) {
        requestAnimationFrame(() => {
          const element = document.querySelector(`[data-instruction-id="linked-${parentId}-${linkedId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
        break;
      }
    }
  }, [selectedLinkedInstructionId]);

  return (
    <>
      {isPreview && (
        <AdminNotesPanel
          missionId={mission.id}
          missionTitle={mission.title}
          initialNotes={adminNotes}
        />
      )}
      {isPreview && (
        <div className={styles.previewBar}>
          <button
            onClick={() => {
              // Use hard navigation so the admin loader always re-runs
              // and picks up any notes saved in the preview panel.
              window.location.href = `/admin/missions?missionId=${mission.id}`;
            }}
            className={styles.menuLink}
          >
            <ArrowLeft size={18} />
            Back to Admin
          </button>
          <statusFetcher.Form method="post" className={styles.statusForm}>
            <input type="hidden" name="actionType" value="updateStatus" />
            <label className={styles.statusLabel} htmlFor="mission-status-select">
              Status:
            </label>
            <select
              id="mission-status-select"
              name="status"
              className={styles.statusSelect}
              value={currentStatus}
              onChange={(e) => {
                const fd = new FormData();
                fd.set("actionType", "updateStatus");
                fd.set("status", e.target.value);
                statusFetcher.submit(fd, { method: "post" });
              }}
            >
              <option value="Hide">Hide</option>
              <option value="For all">For all</option>
              <option value="Only Adama">Only Adama</option>
              <option value="Only Bazn">Only Bazn</option>
            </select>
            {statusFetcher.state !== "idle" && (
              <span className={styles.statusSaving}>Saving…</span>
            )}
            {statusFetcher.state === "idle" && statusFetcher.data?.success === true && (
              <span className={styles.statusSaved}>✓ Saved</span>
            )}
          </statusFetcher.Form>
        </div>
      )}
      <div className={styles.container}>
        <section className={styles.instructionListSection}>
          <div className={styles.headerWrapper}>
            {!isPreview && (
              <Link to="/" className={styles.menuLink}>
                <BookOpen size={18} />
                View All Missions
              </Link>
            )}
            {!isPreview && previousMissionId && (
              <button onClick={handleBackClick} className={styles.menuLink}>
                <ArrowLeft size={18} />
                Back to Previous Mission
              </button>
            )}
            <h1 className={styles.sectionHeader}>{mission.title}</h1>
            <div className={styles.captionToggleGroup}>
              <button
                className={`${styles.captionToggleButton} ${captionVisible ? styles.captionToggleActive : ""}`}
                onClick={() => setCaptionVisible(true)}
                title="Show captions"
                aria-pressed={captionVisible}
              >
                <List size={16} />
              </button>
              <button
                className={`${styles.captionToggleButton} ${!captionVisible ? styles.captionToggleActive : ""}`}
                onClick={() => setCaptionVisible(false)}
                title="Hide captions"
                aria-pressed={!captionVisible}
              >
                <ListX size={16} />
              </button>
            </div>
          </div>
          <div className={styles.missionDescription}>
            <Markdown remarkPlugins={[remarkBreaks]}>{mission.description}</Markdown>
          </div>
          <div className={styles.instructionList}>
            {missionInstructions.map((instruction, index) => {
              const isComment = "type" in instruction && instruction.type === "comment";
              const isIf = "type" in instruction && instruction.type === "if";
              const isEndIf = "type" in instruction && instruction.type === "end-if";
              const isTemp = "type" in instruction && instruction.type === "temp";
              const isIfExpanded = isIf && expandedIfBlocks.has(instruction.id);
              const isLinkExpanded = expandedLinkInstructions.has(instruction.id);
              const isLoading = loadingLinkInstructions.has(instruction.id);
              const expandedInstructions = expandedLinkInstructions.get(instruction.id);

              // Hide instructions that are inside a collapsed IF block
              if (hiddenByIf.has(instruction.id)) {
                return null;
              }

              // Order number (excluding comments, IF and END-IF entries; temp entries count)
              const orderNumber = missionInstructions
                .slice(0, index + 1)
                .filter(
                  (inst) => {
                    if (!inst) return false;
                    if ("type" in inst) return inst.type !== "comment" && inst.type !== "if" && inst.type !== "end-if";
                    return true; // no type field = default instruction, count it
                  }
                ).length;

              // Render comments
              if (isComment) {
                return (
                  <div key={instruction.id} className={styles.instructionItem}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "var(--space-3) var(--space-4)",
                        color: "var(--color-accent-11)",
                        fontStyle: "italic",
                        fontSize: "0.9rem",
                        cursor: "default",
                        opacity: 0.8,
                      }}
                    >
                      <span style={{ marginRight: "var(--space-2)", flexShrink: 0 }}>💬</span>
                      <div className={styles.commentMarkdown}>
                        <Markdown remarkPlugins={[remarkBreaks]}>{instruction.title}</Markdown>
                      </div>
                    </div>
                  </div>
                );
              }

              // Render IF block toggle
              if (isIf) {
                return (
                  <div key={instruction.id} className={styles.instructionItem} data-instruction-id={instruction.id}>
                    <button
                      onClick={() => toggleIfBlock(instruction.id)}
                      className={styles.ifBlockButton}
                      aria-expanded={isIfExpanded}
                    >
                      <GitBranch size={18} className={styles.ifBlockIcon} />
                      <span className={styles.ifBlockTitle}>{instruction.title}</span>
                      {isIfExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                );
              }

              // Render END-IF as a thin green divider line
              if (isEndIf) {
                return <div key={instruction.id} className={styles.endIfDivider} aria-hidden="true" />;
              }

              return (
                <div key={instruction.id}>
                  <div className={styles.instructionItem} data-instruction-id={instruction.id}>
                    <InstructionListItem
                      title={instruction.title}
                      description={instruction.description}
                      selected={selectedInstructionId === instruction.id}
                      onClick={(event) => handleInstructionClick(instruction.id, event)}
                      instructionType={"type" in instruction && instruction.type !== "temp" ? instruction.type : undefined}
                      explanation={"explanation" in instruction ? instruction.explanation : []}
                      className={styles.instructionListItem}
                      orderNumber={orderNumber}
                      isCompleted={completedInstructions.has(instruction.id)}
                    />
                    {isPreview && !isTemp && (
                      <div className={styles.editInstructionRow}>
                        <button
                          className={styles.editInstructionButton}
                          onClick={() => {
                            // Strip the duplicate-occurrence suffix before navigating to admin
                            const editId = instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id;
                            navigate(`/admin/instructions?instructionId=${editId}`);
                          }}
                          title={`Edit instruction ${instruction.id}`}
                        >
                          ✏️ Edit ^
                        </button>
                        <instrStatusFetcher.Form method="post" className={styles.instrStatusForm}>
                          <input type="hidden" name="actionType" value="updateInstructionStatus" />
                          {/* Strip the suffix — status is stored on the base instruction in the DB */}
                          <input type="hidden" name="instructionId" value={instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id} />
                          <label className={styles.instrStatusLabel} htmlFor={`instr-status-${instruction.id}`}>
                            Status:
                          </label>
                          <select
                            id={`instr-status-${instruction.id}`}
                            name="status"
                            className={styles.instrStatusSelect}
                            value={getInstrStatus(instruction as { id: string; status?: string })}
                            onChange={(e) => submitInstrStatus(instruction.id, e.target.value as InstructionStatus)}
                          >
                            <option value="only title">only title</option>
                            <option value="partial explanation">partial explanation</option>
                            <option value="full explanation">full explanation</option>
                          </select>
                          {instrStatusFetcher.state !== "idle" &&
                            instrStatusFetcher.formData?.get("instructionId") === instruction.id && (
                              <span className={styles.statusSaving}>Saving…</span>
                            )}
                          {instrStatusFetcher.state === "idle" &&
                            instrStatusFetcher.data?.success === true &&
                            instrStatusFetcher.data.instructionId === instruction.id && (
                              <span className={styles.statusSaved}>✓</span>
                            )}
                        </instrStatusFetcher.Form>
                      </div>
                    )}
                    {"type" in instruction && instruction.type === "link" && "missionId" in instruction && (
                      <div style={{ marginLeft: "1rem", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
                        {isLoading ? "Loading..." : isLinkExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                    {selectedInstructionId === instruction.id &&
                      ("type" in instruction ? instruction.type !== "link" && instruction.type !== "temp" : true) &&
                      !isComment &&
                      "explanation" in instruction &&
                      Array.isArray(instruction.explanation) &&
                      instruction.explanation.length > 0 && (
                        <div className={styles.mobileExplanation}>
                          <ExplanationDisplay instruction={instruction as Instruction} captionVisible={captionVisible} />
                        </div>
                      )}
                  </div>

                  {/* Render expanded linked mission instructions */}
                  {isLinkExpanded && expandedInstructions && (
                    <div style={{ marginLeft: "2rem", marginTop: "0.5rem", marginBottom: "1rem" }}>
                      {expandedInstructions.map((linkedInstruction, linkedIndex) => {
                        const linkedSelected =
                          selectedLinkedInstructionId.get(instruction.id) === linkedInstruction.id;
                        return (
                          <div
                            key={`${instruction.id}-${linkedInstruction.id}`}
                            className={styles.instructionItem}
                            data-instruction-id={`linked-${instruction.id}-${linkedInstruction.id}`}
                          >
                            <InstructionListItem
                              title={linkedInstruction.title}
                              description={linkedInstruction.description}
                              selected={linkedSelected}
                              instructionType={linkedInstruction.type}
                              explanation={linkedInstruction.explanation}
                              orderNumber={linkedIndex + 1}
                              isCompleted={completedInstructions.has(`${instruction.id}-${linkedInstruction.id}`)}
                              onClick={(event) => handleLinkedInstructionClick(instruction.id, linkedInstruction, event)}
                            />
                            {linkedSelected && linkedInstruction.type !== "link" && (
                              <div className={styles.mobileExplanation}>
                                <ExplanationDisplay instruction={linkedInstruction} captionVisible={captionVisible} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.explanationSection}>
          <ExplanationDisplay instruction={instructionToDisplay as Instruction | null} className={styles.explanationContainer} captionVisible={captionVisible} />
        </section>
      </div>
    </>
  );
}
