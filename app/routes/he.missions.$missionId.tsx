import { useState, useEffect, useRef } from "react";
import { data, redirect, Link, useNavigate, useLocation, useSearchParams, useFetcher, useRevalidator } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/he.missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import {
  BookOpen, ArrowLeft, ChevronUp, ChevronDown, GitBranch,
  StickyNote, Plus, Pencil, Trash2, Check, X, BookMarked,
} from "lucide-react";
import styles from "./he.missions.$missionId.module.css";
import { getMissionByIdHe, getAllMissionsHe, checkMissionAccess } from "~/services/missions.server";
import { getInstructionsByIdsHe } from "~/services/instructions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import { useAuth } from "~/hooks/use-auth";
import type { Instruction } from "~/data/instructions-he";
import { MISSION_STATUSES, normalizeMissionStatus, type MissionStatus, VALID_MISSION_STATUSES } from "~/data/mission-constants";

export function meta({ data }: Route.MetaArgs) {
  const mission = data?.mission;
  return [
    { title: mission ? `${mission.title} - משימות` : "משימה לא נמצאה" },
    { name: "description", content: mission?.description || "פרטי משימה" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const mission = await getMissionByIdHe(params.missionId);

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

  const allMissions = await getAllMissionsHe();
  const rawIds = mission.instructions.map(([id]) => id);
  const uniqueBaseIds = [...new Set(rawIds.map((id) => (id.includes("#") ? id.split("#")[0] : id)))];
  const instructions = await getInstructionsByIdsHe(uniqueBaseIds);

  let adminNotes: string[] = [];
  let allInstructionIds: string[] = [];
  let allInstructionsList: { id: string; title: string }[] = [];

  if (isPreview) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
    const [notesResult, instrResult] = await Promise.all([
      supabase.from("missions").select("admin_notes").eq("id", params.missionId).single(),
      supabase.from("instructions").select("id, data_he").order("created_at", { ascending: true }),
    ]);
    adminNotes = Array.isArray(notesResult.data?.admin_notes) ? notesResult.data.admin_notes : [];
    allInstructionIds = (instrResult.data || []).map((r: { id: string }) => r.id);
    allInstructionsList = (instrResult.data || []).map(
      (r: { id: string; data_he?: { title?: string } }) => ({
        id: r.id,
        title: r.data_he?.title || r.id,
      })
    );
  }

  return { mission, instructions, allMissions, isPreview, adminNotes, allInstructionIds, allInstructionsList };
}

type InstructionStatus = "only title" | "partial explanation" | "full explanation";

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "saveMissionAdminNote") {
    const notesJson = formData.get("notes") as string;
    const accessToken = formData.get("accessToken") as string | null;

    if (!accessToken) {
      return { success: false, error: "Unauthorized: Authentication required" };
    }

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
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
      );
      const { data: updated, error } = await supabase
        .from("missions")
        .update({ admin_notes: notes })
        .eq("id", params.missionId)
        .select("id");
      if (error) return { success: false, error: error.message };
      if (!updated || updated.length === 0) {
        return { success: false, error: `No mission row matched id=${params.missionId}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  if (actionType === "updateStatus") {
    const newStatus = formData.get("status") as MissionStatus;
    const validStatuses: readonly MissionStatus[] = VALID_MISSION_STATUSES;
    if (!validStatuses.includes(newStatus)) {
      return { success: false, error: "Invalid status value" };
    }
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
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
    const accessToken = formData.get("accessToken") as string | null;
    const validStatuses: InstructionStatus[] = ["only title", "partial explanation", "full explanation"];
    if (!instructionId || !validStatuses.includes(newStatus)) {
      return { success: false, error: "Invalid instructionId or status value" };
    }
    if (!accessToken) {
      return { success: false, instructionId, error: "Unauthorized: Authentication required" };
    }
    try {
      const { createClient } = await import("@supabase/supabase-js");
      // Use an authenticated client so RLS UPDATE policies allow the write.
      // The anon client is silently blocked by RLS on the `instructions` table.
      const supabase = createClient(
        process.env.SUPABASE_PROJECT_URL!,
        process.env.SUPABASE_API_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
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
      const { data: updated, error } = await supabase
        .from("instructions")
        .update({ data_en: updatedDataEn, updated_at: new Date().toISOString() })
        .eq("id", instructionId)
        .select("id");
      if (error) return { success: false, instructionId, error: error.message };
      if (!updated || updated.length === 0) {
        return { success: false, instructionId, error: `No instruction row matched id=${instructionId}` };
      }
      return { success: true, instructionId };
    } catch (err) {
      return { success: false, instructionId: instructionId as string, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  return { success: false, error: "Unknown action" };
}

type CommentEntry = { id: string; title: string; description: string; status: "comment"; type: "comment"; explanation: [] };
type IfEntry = { id: string; title: string; description: string; status: "if"; type: "if"; explanation: [] };
type EndIfEntry = { id: string; title: string; description: string; status: "end-if"; type: "end-if"; explanation: [] };
type ElseEntry = { id: string; title: string; description: string; status: "else"; type: "else"; explanation: [] };
type TempEntry = { id: string; title: string; description: string; status: "temp"; type: "temp"; explanation: [] };

export default function HeMissionPage({ loaderData, params }: Route.ComponentProps) {
  const {
    mission, instructions, allMissions, isPreview,
    adminNotes: initialAdminNotes, allInstructionIds, allInstructionsList,
  } = loaderData;
  const { session } = useAuth();
  const statusFetcher = useFetcher();

  // Optimistic status
  const currentStatus = normalizeMissionStatus(
    (statusFetcher.formData?.get("status") as MissionStatus | undefined) ?? mission.status,
  );

  // Single shared fetcher for all instruction status updates
  const instrStatusFetcher = useFetcher<{ success: boolean; instructionId?: string; error?: string }>();
  const optimisticInstrStatus: Record<string, InstructionStatus> = {};
  if (instrStatusFetcher.formData?.get("actionType") === "updateInstructionStatus") {
    const id = instrStatusFetcher.formData.get("instructionId") as string;
    const st = instrStatusFetcher.formData.get("status") as InstructionStatus;
    if (id && st) optimisticInstrStatus[id] = st;
  }

  const getInstrStatus = (instruction: { id: string; status?: string }): InstructionStatus => {
    // Status is stored on the base instruction — strip the duplicate-occurrence suffix (#2, #3, …)
    const baseId = instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id;
    return (
      optimisticInstrStatus[baseId] ??
      (instruction.status as InstructionStatus | undefined) ??
      "only title"
    );
  };

  const submitInstrStatus = (instructionId: string, newStatus: InstructionStatus) => {
    const baseId = instructionId.includes("#") ? instructionId.split("#")[0] : instructionId;
    const fd = new FormData();
    fd.set("actionType", "updateInstructionStatus");
    fd.set("instructionId", baseId);
    fd.set("status", newStatus);
    // RLS UPDATE policies block the anon client silently — pass the admin's token.
    fd.set("accessToken", session?.access_token || "");
    instrStatusFetcher.submit(fd, { method: "post" });
  };

  // Build flat mission instruction list with special entries
  const missionInstructions = mission.instructions
    .map(([id, customTitle]) => {
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
      if (/^T\d+$/.test(id)) {
        return { id, title: customTitle || id, description: "", status: "temp" as const, type: "temp" as const, explanation: [] as [] };
      }
      const baseId = id.includes("#") ? id.split("#")[0] : id;
      const instruction = instructions.find((inst) => inst.id === baseId);
      if (!instruction) return null;
      const resolved = customTitle ? { ...instruction, title: customTitle } : instruction;
      return id !== baseId ? { ...resolved, id } : resolved;
    })
    .filter(Boolean) as (NonNullable<ReturnType<typeof instructions["find"]>> | CommentEntry | IfEntry | EndIfEntry | ElseEntry | TempEntry)[];

  // Build nested IF/ELSE structure using a stack-based parser.
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const elseChildrenOf = new Map<string, string[]>();
  const elseIdOf = new Map<string, string>();
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
        // Validate the end-if ID against the stack top before popping.
        const expectedIfId = "if-" + id.slice("end-if-".length);
        if (stack.length > 0) {
          if (stack[stack.length - 1] === expectedIfId) {
            const closed = stack.pop()!;
            inElseBranch.delete(closed);
          } else {
            const matchIdx = stack.lastIndexOf(expectedIfId);
            if (matchIdx !== -1) {
              const removed = stack.splice(matchIdx);
              for (const r of removed) inElseBranch.delete(r);
            }
            // If not found at all, this end-if is orphaned — skip it
          }
        }
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

  const insideIfBlock = new Set<string>(parentOf.keys());

  // Instructions panel state (preview mode only)
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructionSearch, setInstructionSearch] = useState("");

  // Admin notes panel state
  const [notesOpen, setNotesOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState<string[]>(initialAdminNotes ?? []);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const adminNotesFetcher = useFetcher<{ success: boolean; error?: string }>();
  const newNoteInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingSaveRef = useRef<string[] | null>(null);

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
    fd.set("accessToken", session?.access_token || "");
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

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  const [selectedLinkedInstructionId, setSelectedLinkedInstructionId] = useState<Map<string, string | null>>(new Map());
  const [expandedLinkInstructions, setExpandedLinkInstructions] = useState<Map<string, Instruction[]>>(new Map());
  // Metadata (raw ids + mission info) for expanded linked missions — needed to persist instruction-title renames
  const [linkedMissionMeta, setLinkedMissionMeta] = useState<Map<string, { missionId: string; missionTitle: string; missionDescription: string; missionStatus: MissionStatus; rawInstructions: [string, string?][] }>>(new Map());
  const [loadingLinkInstructions, setLoadingLinkInstructions] = useState<Set<string>>(new Set());
  const [completedInstructions, setCompletedInstructions] = useState<Set<string>>(new Set());
  const [expandedIfBlocks, setExpandedIfBlocks] = useState<Map<string, "if" | "else">>(new Map());

  // hiddenByIf — items inside collapsed or non-active IF branch
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

  const collectDescendantIfIds = (ifId: string): string[] => {
    const result: string[] = [];
    const queue = [...(childrenOf.get(ifId) ?? []), ...(elseChildrenOf.get(ifId) ?? [])];
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

  const toggleIfBlock = (ifId: string, branch: "if" | "else" = "if") => {
    setExpandedIfBlocks((prev) => {
      const next = new Map(prev);
      const isCollapsing = next.get(ifId) === branch;
      if (isCollapsing) {
        next.delete(ifId);
      } else {
        next.set(ifId, branch);
      }
      for (const descendantId of collectDescendantIfIds(ifId)) {
        next.delete(descendantId);
      }
      return next;
    });
  };

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const previousMissionId = (location.state as { from?: string })?.from;

  const handleLinkInstructionClick = async (instructionId: string, linkedMissionId: string) => {
    if (expandedLinkInstructions.has(instructionId)) {
      const newMap = new Map(expandedLinkInstructions);
      newMap.delete(instructionId);
      setExpandedLinkInstructions(newMap);
      setLinkedMissionMeta((prev) => {
        const next = new Map(prev);
        next.delete(instructionId);
        return next;
      });
    } else {
      setLoadingLinkInstructions(new Set([...loadingLinkInstructions, instructionId]));
      try {
        const response = await fetch(`/api/he/missions/${linkedMissionId}`);
        if (!response.ok) { console.error("Failed to fetch linked mission"); return; }
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
        setLinkedMissionMeta((prev) => {
          const next = new Map(prev);
          next.set(instructionId, {
            missionId: linkedMission.id,
            missionTitle: linkedMission.title,
            missionDescription: linkedMission.description,
            missionStatus: normalizeMissionStatus(linkedMission.status),
            rawInstructions: linkedMission.instructions,
          });
          return next;
        });
      } catch (error) {
        console.error("Error fetching linked mission:", error);
      } finally {
        const newLoading = new Set(loadingLinkInstructions);
        newLoading.delete(instructionId);
        setLoadingLinkInstructions(newLoading);
      }
    }
  };

  // --- Rename instruction title within a mission (mission-local title override) ---
  const revalidator = useRevalidator();
  const renameMissionFetcher = useFetcher<{ success: boolean; error?: string }>();
  const [renameTarget, setRenameTarget] = useState<
    | { scope: "main"; instructionId: string }
    | { scope: "linked"; instructionId: string; parentLinkId: string }
    | null
  >(null);
  const [renameTitleInput, setRenameTitleInput] = useState("");
  const [pendingRenameContext, setPendingRenameContext] = useState<typeof renameTarget>(null);

  const openRenameDialog = (scope: "main" | "linked", instructionId: string, currentTitle: string, parentLinkId?: string) => {
    setRenameTitleInput(currentTitle);
    setRenameTarget(
      scope === "main"
        ? { scope: "main", instructionId }
        : { scope: "linked", instructionId, parentLinkId: parentLinkId! },
    );
  };

  const persistInstructionRename = (
    missionMeta: { id: string; title: string; description: string; status: MissionStatus },
    rawInstructions: [string, string?][],
    instructionId: string,
    newTitle: string,
  ) => {
    const updatedInstructions = rawInstructions.map(([id, title]) =>
      id === instructionId
        ? (newTitle ? ([id, newTitle] as [string, string?]) : ([id] as [string, string?]))
        : ([id, title] as [string, string?])
    );
    const updatedMission = {
      id: missionMeta.id,
      title: missionMeta.title,
      description: missionMeta.description,
      instructions: updatedInstructions,
      status: missionMeta.status,
    };
    const fd = new FormData();
    fd.append("actionType", "saveMission");
    fd.append("id", missionMeta.id);
    fd.append("dataEn", JSON.stringify(updatedMission));
    fd.append("language", "he");
    fd.append("accessToken", session?.access_token || "");
    renameMissionFetcher.submit(fd, { method: "post", action: "/admin" });
  };

  const handleRenameSave = () => {
    if (!renameTarget) return;
    const newTitle = renameTitleInput.trim();

    if (renameTarget.scope === "main") {
      persistInstructionRename(
        { id: mission.id, title: mission.title, description: mission.description, status: normalizeMissionStatus(mission.status) },
        mission.instructions,
        renameTarget.instructionId,
        newTitle,
      );
    } else {
      const meta = linkedMissionMeta.get(renameTarget.parentLinkId);
      if (!meta) {
        setRenameTarget(null);
        return;
      }
      persistInstructionRename(
        { id: meta.missionId, title: meta.missionTitle, description: meta.missionDescription, status: meta.missionStatus },
        meta.rawInstructions,
        renameTarget.instructionId,
        newTitle,
      );
    }

    setPendingRenameContext(renameTarget);
    setRenameTarget(null);
  };

  // After a rename save completes, refresh the affected mission's data
  useEffect(() => {
    if (!pendingRenameContext) return;
    if (renameMissionFetcher.state !== "idle" || !renameMissionFetcher.data) return;

    if (!renameMissionFetcher.data.success) {
      alert(`Failed to rename instruction: ${renameMissionFetcher.data.error || "Unknown error"}`);
      setPendingRenameContext(null);
      return;
    }

    if (pendingRenameContext.scope === "main") {
      revalidator.revalidate();
    } else {
      const { parentLinkId } = pendingRenameContext;
      const meta = linkedMissionMeta.get(parentLinkId);
      if (meta) {
        (async () => {
          try {
            const response = await fetch(`/api/he/missions/${meta.missionId}`);
            if (!response.ok) return;
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
            setExpandedLinkInstructions((prev) => {
              const next = new Map(prev);
              next.set(parentLinkId, linkedMissionInstructions);
              return next;
            });
            setLinkedMissionMeta((prev) => {
              const next = new Map(prev);
              next.set(parentLinkId, {
                missionId: linkedMission.id,
                missionTitle: linkedMission.title,
                missionDescription: linkedMission.description,
                missionStatus: normalizeMissionStatus(linkedMission.status),
                rawInstructions: linkedMission.instructions,
              });
              return next;
            });
          } catch (err) {
            console.error("Error refreshing linked mission after rename:", err);
          }
        })();
      }
    }
    setPendingRenameContext(null);
  }, [renameMissionFetcher.state, renameMissionFetcher.data, pendingRenameContext]);

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
        if (current) setCompletedInstructions((c) => new Set([...c, current]));
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
      navigate(`/he/missions/${previousMissionId}`);
    } else {
      navigate("/he");
    }
  };

  const selectedInstruction = missionInstructions.find((inst) => inst?.id === selectedInstructionId) || null;

  const instructionToDisplay =
    selectedInstruction &&
    "type" in selectedInstruction &&
    (selectedInstruction.type === "comment" || selectedInstruction.type === "if" || selectedInstruction.type === "else" || selectedInstruction.type === "temp")
      ? null
      : selectedInstruction;

  // Scroll selected instruction to top
  useEffect(() => {
    if (selectedInstructionId) {
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-instruction-id="${selectedInstructionId}"]`);
        if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [selectedInstructionId]);

  useEffect(() => {
    for (const [parentId, linkedId] of selectedLinkedInstructionId) {
      if (linkedId) {
        requestAnimationFrame(() => {
          const element = document.querySelector(`[data-instruction-id="linked-${parentId}-${linkedId}"]`);
          if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        break;
      }
    }
  }, [selectedLinkedInstructionId]);

  return (
    <>
      {isPreview && (
        <>
          <div className={styles.previewBar}>
            <button
              onClick={() => navigate(`/admin/missions?missionId=${params.missionId}`)}
              className={styles.menuLink}
            >
              <ArrowLeft size={18} />
              חזור לניהול
            </button>

            {/* Instructions toggle button */}
            <button
              className={`${styles.menuLink} ${instructionsOpen ? styles.menuLinkActive : ""}`}
              onClick={() => {
                setInstructionsOpen((v) => !v);
                if (notesOpen) setNotesOpen(false);
              }}
              aria-pressed={instructionsOpen}
              title="הצג / הסתר את כל ההוראות הזמינות"
            >
              <BookMarked size={15} />
              הוראות
              {allInstructionsList && allInstructionsList.length > 0 && (
                <span className={styles.notesBadge}>{allInstructionsList.length}</span>
              )}
            </button>

            {/* Notes toggle button */}
            <button
              className={`${styles.menuLink} ${notesOpen ? styles.menuLinkActive : ""}`}
              onClick={() => {
                setNotesOpen((v) => !v);
                if (instructionsOpen) setInstructionsOpen(false);
                if (!notesOpen) setTimeout(() => newNoteInputRef.current?.focus(), 80);
              }}
              aria-pressed={notesOpen}
              title="הצג / הסתר הערות מחבר למשימה זו"
            >
              <StickyNote size={15} />
              הערות
              {adminNotes.length > 0 && (
                <span className={styles.notesBadge}>{adminNotes.length}</span>
              )}
            </button>

            {/* Status select */}
            <statusFetcher.Form method="post" className={styles.statusForm}>
              <input type="hidden" name="actionType" value="updateStatus" />
              <label className={styles.statusLabel} htmlFor="he-mission-status-select">
                סטטוס:
              </label>
              <select
                id="he-mission-status-select"
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
                {MISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {statusFetcher.state !== "idle" && (
                <span className={styles.statusSaving}>שומר…</span>
              )}
              {statusFetcher.state === "idle" && statusFetcher.data?.success === true && (
                <span className={styles.statusSaved}>✓ נשמר</span>
              )}
            </statusFetcher.Form>
          </div>

          {/* Instructions panel */}
          {instructionsOpen && (
            <div className={styles.notesPanel}>
              <div className={styles.notesPanelHeader}>
                <span className={styles.notesPanelTitle}>
                  <BookMarked size={14} /> כל ההוראות
                  {allInstructionsList && allInstructionsList.length > 0 && ` (${allInstructionsList.length})`}
                </span>
              </div>
              <input
                className={styles.instructionsSearchInput}
                type="text"
                placeholder="חיפוש לפי מזהה או כותרת…"
                value={instructionSearch}
                onChange={(e) => setInstructionSearch(e.target.value)}
                autoFocus
              />
              <ul className={styles.instructionsList}>
                {(allInstructionsList ?? [])
                  .filter((instr) => {
                    const q = instructionSearch.toLowerCase();
                    return !q || instr.id.toLowerCase().includes(q) || instr.title.toLowerCase().includes(q);
                  })
                  .map((instr) => (
                    <li key={instr.id} className={styles.instructionsListItem}>
                      <span className={styles.instructionIdBadge}>{instr.id}</span>
                      <button
                        className={styles.instructionsListTitle}
                        onClick={() => navigate(`/admin/instructions?instructionId=${instr.id}`)}
                        title={`פתח הוראה ${instr.id} בניהול`}
                      >
                        {instr.title}
                      </button>
                    </li>
                  ))}
                {(allInstructionsList ?? []).filter((instr) => {
                  const q = instructionSearch.toLowerCase();
                  return !q || instr.id.toLowerCase().includes(q) || instr.title.toLowerCase().includes(q);
                }).length === 0 && (
                  <li className={styles.notesEmpty}>אין הוראות התואמות את החיפוש.</li>
                )}
              </ul>
            </div>
          )}

          {/* Admin notes panel */}
          {notesOpen && (
            <div className={styles.notesPanel}>
              <div className={styles.notesPanelHeader}>
                <span className={styles.notesPanelTitle}>
                  <StickyNote size={14} /> הערות מחבר
                  {adminNotes.length > 0 && ` (${adminNotes.length})`}
                </span>
                {adminNotesFetcher.state !== "idle" && (
                  <span className={styles.statusSaving}>שומר…</span>
                )}
                {adminNotesFetcher.state === "idle" && adminNotesFetcher.data?.success === true && (
                  <span className={styles.statusSaved}>✓ נשמר</span>
                )}
                {adminNotesFetcher.state === "idle" && adminNotesFetcher.data?.success === false && (
                  <span className={styles.statusSaving} style={{ color: "var(--color-error-11)" }}>
                    ⚠ {adminNotesFetcher.data.error || "שמירה נכשלה"}
                  </span>
                )}
              </div>

              {adminNotes.length > 0 && (
                <ul className={styles.notesList}>
                  {adminNotes.map((note, idx) => (
                    <li key={idx} className={styles.noteItem}>
                      {editingNoteIndex === idx ? (
                        <div className={styles.noteEditRow}>
                          <textarea
                            className={styles.noteTextarea}
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                          <div className={styles.noteEditActions}>
                            <button className={styles.noteActionBtn} onClick={handleSaveEdit} disabled={!editingNoteText.trim()} title="שמור">
                              <Check size={14} />
                            </button>
                            <button className={styles.noteActionBtn} onClick={handleCancelEdit} title="בטל">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.noteViewRow}>
                          <span className={styles.noteText}>{note}</span>
                          <div className={styles.noteViewActions}>
                            <button className={styles.noteActionBtn} onClick={() => handleStartEdit(idx)} title="ערוך הערה">
                              <Pencil size={13} />
                            </button>
                            <button className={`${styles.noteActionBtn} ${styles.noteDeleteBtn}`} onClick={() => handleRemoveNote(idx)} title="מחק הערה">
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
                <p className={styles.notesEmpty}>אין הערות עדיין. הוסף את הראשונה למטה.</p>
              )}

              <div className={styles.notesAddRow}>
                <textarea
                  ref={newNoteInputRef}
                  className={styles.noteTextarea}
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
                <button className={styles.notesAddBtn} onClick={handleAddNote} disabled={!newNoteText.trim()} title="הוסף הערה">
                  <Plus size={16} />
                  הוסף
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className={styles.container} dir="rtl">
        <section className={styles.instructionListSection}>
          <div className={styles.headerWrapper}>
            {!isPreview && (
              <Link to="/he" className={styles.menuLink}>
                <BookOpen size={18} />
                צפה בכל המשימות
              </Link>
            )}
            {!isPreview && previousMissionId && (
              <button onClick={handleBackClick} className={styles.menuLink}>
                <ArrowLeft size={18} />
                חזור למשימה הקודמת
              </button>
            )}
            <h1 className={styles.sectionHeader}>{mission.title}</h1>
          </div>

          <div className={styles.missionDescription}>
            <Markdown remarkPlugins={[remarkBreaks]}>{mission.description}</Markdown>
          </div>

          <div className={styles.instructionList}>
            {missionInstructions.map((instruction, index) => {
              const isComment = "type" in instruction && instruction.type === "comment";
              const isIf = "type" in instruction && instruction.type === "if";
              const isEndIf = "type" in instruction && instruction.type === "end-if";
              const isElse = "type" in instruction && instruction.type === "else";
              const isTemp = "type" in instruction && instruction.type === "temp";
              const activeBranch = isIf ? expandedIfBlocks.get(instruction.id) : undefined;
              const isIfExpanded = isIf && activeBranch !== undefined;
              const isLinkExpanded = expandedLinkInstructions.has(instruction.id);
              const isLoading = loadingLinkInstructions.has(instruction.id);
              const expandedInstructions = expandedLinkInstructions.get(instruction.id);

              if (isElse) return null;
              if (hiddenByIf.has(instruction.id)) return null;

              // Order number (excluding structural entries)
              const orderNumber = missionInstructions
                .slice(0, index + 1)
                .filter((inst) => {
                  if (!inst) return false;
                  if ("type" in inst) return inst.type !== "comment" && inst.type !== "if" && inst.type !== "end-if" && inst.type !== "else";
                  return true;
                }).length;

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
                      <span style={{ marginLeft: "var(--space-2)", flexShrink: 0 }}>💬</span>
                      <div className={styles.commentMarkdown}>
                        <Markdown remarkPlugins={[remarkBreaks]}>{instruction.title}</Markdown>
                      </div>
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

                return (
                  <div
                    key={instruction.id}
                    className={styles.instructionItem}
                    data-instruction-id={instruction.id}
                    style={depth > 0 ? { paddingRight: `calc(${depth} * var(--space-5))` } : undefined}
                  >
                    {hasElse ? (
                      <div className={styles.ifElseRow}>
                        <button
                          onClick={() => toggleIfBlock(instruction.id, "if")}
                          className={`${styles.ifBlockButton} ${styles.ifElseHalf} ${depth > 0 ? styles.ifBlockButtonNested : ""} ${activeBranch === "if" ? styles.ifBranchActive : ""}`}
                          aria-expanded={activeBranch === "if"}
                        >
                          <GitBranch size={depth > 0 ? 15 : 18} className={styles.ifBlockIcon} />
                          <span className={styles.ifBlockTitle}>{instruction.title}</span>
                          {activeBranch === "if" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button
                          onClick={() => toggleIfBlock(instruction.id, "else")}
                          className={`${styles.ifBlockButton} ${styles.ifElseHalf} ${styles.elseBlockButton} ${depth > 0 ? styles.ifBlockButtonNested : ""} ${activeBranch === "else" ? styles.elseBranchActive : ""}`}
                          aria-expanded={activeBranch === "else"}
                        >
                          <GitBranch size={depth > 0 ? 15 : 18} className={styles.ifBlockIcon} />
                          <span className={styles.ifBlockTitle}>{elseTitle}</span>
                          {activeBranch === "else" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleIfBlock(instruction.id, "if")}
                        className={`${styles.ifBlockButton} ${depth > 0 ? styles.ifBlockButtonNested : ""}`}
                        aria-expanded={isIfExpanded}
                      >
                        <GitBranch size={depth > 0 ? 15 : 18} className={styles.ifBlockIcon} />
                        <span className={styles.ifBlockTitle}>{instruction.title}</span>
                        {isIfExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                );
              }

              if (isEndIf) {
                const matchingIfId = instruction.id.replace(/^end-if-/, "if-");
                if (!expandedIfBlocks.has(matchingIfId)) return null;
                return <div key={instruction.id} className={styles.endIfDivider} aria-hidden="true" />;
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
                      isInsideIfBlock={insideIfBlock.has(instruction.id)}
                    />
                    {isPreview && selectedInstructionId === instruction.id && (
                      <div className={styles.editInstructionRow}>
                        <span className={styles.instructionIdBadge} title="Instruction ID" style={{ marginRight: "auto" }}>
                          ID: {instruction.id}
                        </span>
                        <button
                          className={styles.editInstructionButton}
                          onClick={() => {
                            const editId = instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id;
                            navigate(`/admin/instructions?instructionId=${editId}`);
                          }}
                          title={`ערוך הוראה ${instruction.id}`}
                          disabled={isTemp}
                        >
                          ✏️ ערוך ^
                        </button>
                        <button
                          className={styles.renameInstructionButton}
                          onClick={() =>
                            openRenameDialog(
                              "main",
                              instruction.id,
                              mission.instructions.find(([id]) => id === instruction.id)?.[1] || "",
                            )
                          }
                          title={`שנה שם להוראה ${instruction.id} עבור משימה זו`}
                        >
                          🏷️ שנה שם
                        </button>
                        {!isTemp && (
                          <instrStatusFetcher.Form method="post" className={styles.instrStatusForm}>
                            <input type="hidden" name="actionType" value="updateInstructionStatus" />
                            <input type="hidden" name="instructionId" value={instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id} />
                            <label className={styles.instrStatusLabel} htmlFor={`he-instr-status-${instruction.id}`}>
                              סטטוס:
                            </label>
                            <select
                              id={`he-instr-status-${instruction.id}`}
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
                              instrStatusFetcher.formData?.get("instructionId") ===
                                (instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id) && (
                                <span className={styles.statusSaving}>שומר…</span>
                              )}
                            {instrStatusFetcher.state === "idle" &&
                              instrStatusFetcher.data?.success === true &&
                              instrStatusFetcher.data.instructionId ===
                                (instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id) && (
                                <span className={styles.statusSaved}>✓</span>
                              )}
                          </instrStatusFetcher.Form>
                        )}
                      </div>
                    )}
                    {"type" in instruction && instruction.type === "link" && "missionId" in instruction && (
                      <div style={{ marginRight: "1rem", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
                        {isLoading ? "טוען..." : isLinkExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                    {selectedInstructionId === instruction.id &&
                      ("type" in instruction ? instruction.type !== "link" && instruction.type !== "temp" : true) &&
                      !isComment &&
                      "explanation" in instruction &&
                      Array.isArray(instruction.explanation) &&
                      instruction.explanation.length > 0 && (
                        <div className={styles.mobileExplanation}>
                          <ExplanationDisplay instruction={instruction as Instruction} captionVisible={true} />
                        </div>
                      )}
                  </div>

                  {/* Render expanded linked mission instructions */}
                  {isLinkExpanded && expandedInstructions && (
                    <div style={{ marginRight: "2rem", marginTop: "0.5rem", marginBottom: "1rem" }}>
                      {expandedInstructions.map((linkedInstruction, linkedIndex) => {
                        const linkedSelected = selectedLinkedInstructionId.get(instruction.id) === linkedInstruction.id;
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
                            {isPreview && linkedSelected && (
                              <div className={styles.editInstructionRow}>
                                <span className={styles.instructionIdBadge} title="Instruction ID" style={{ marginRight: "auto" }}>
                                  ID: {linkedInstruction.id}
                                </span>
                                <button
                                  className={styles.editInstructionButton}
                                  onClick={() => {
                                    const editId = linkedInstruction.id.includes("#") ? linkedInstruction.id.split("#")[0] : linkedInstruction.id;
                                    navigate(`/admin/instructions?instructionId=${editId}`);
                                  }}
                                  title={`ערוך הוראה ${linkedInstruction.id}`}
                                >
                                  ✏️ ערוך ^
                                </button>
                                <button
                                  className={styles.renameInstructionButton}
                                  onClick={() =>
                                    openRenameDialog(
                                      "linked",
                                      linkedInstruction.id,
                                      linkedMissionMeta.get(instruction.id)?.rawInstructions.find(([id]) => id === linkedInstruction.id)?.[1] || "",
                                      instruction.id,
                                    )
                                  }
                                  title={`שנה שם להוראה ${linkedInstruction.id} עבור משימה זו`}
                                >
                                  🏷️ שנה שם
                                </button>
                                <instrStatusFetcher.Form method="post" className={styles.instrStatusForm}>
                                  <input type="hidden" name="actionType" value="updateInstructionStatus" />
                                  <input type="hidden" name="instructionId" value={linkedInstruction.id.includes("#") ? linkedInstruction.id.split("#")[0] : linkedInstruction.id} />
                                  <label className={styles.instrStatusLabel} htmlFor={`he-instr-status-${instruction.id}-${linkedInstruction.id}`}>
                                    סטטוס:
                                  </label>
                                  <select
                                    id={`he-instr-status-${instruction.id}-${linkedInstruction.id}`}
                                    name="status"
                                    className={styles.instrStatusSelect}
                                    value={getInstrStatus(linkedInstruction as { id: string; status?: string })}
                                    onChange={(e) => submitInstrStatus(linkedInstruction.id, e.target.value as InstructionStatus)}
                                  >
                                    <option value="only title">only title</option>
                                    <option value="partial explanation">partial explanation</option>
                                    <option value="full explanation">full explanation</option>
                                  </select>
                                  {instrStatusFetcher.state !== "idle" &&
                                    instrStatusFetcher.formData?.get("instructionId") ===
                                      (linkedInstruction.id.includes("#") ? linkedInstruction.id.split("#")[0] : linkedInstruction.id) && (
                                      <span className={styles.statusSaving}>שומר…</span>
                                    )}
                                  {instrStatusFetcher.state === "idle" &&
                                    instrStatusFetcher.data?.success === true &&
                                    instrStatusFetcher.data.instructionId ===
                                      (linkedInstruction.id.includes("#") ? linkedInstruction.id.split("#")[0] : linkedInstruction.id) && (
                                      <span className={styles.statusSaved}>✓</span>
                                    )}
                                </instrStatusFetcher.Form>
                              </div>
                            )}
                            {linkedSelected && linkedInstruction.type !== "link" && (
                              <div className={styles.mobileExplanation}>
                                <ExplanationDisplay instruction={linkedInstruction} captionVisible={true} />
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
          <ExplanationDisplay
            instruction={instructionToDisplay as Instruction | null}
            className={styles.explanationContainer}
            captionVisible={true}
          />
        </section>
      </div>

      {renameTarget && (
        <div className={styles.dialogOverlay} onClick={() => setRenameTarget(null)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>שנה שם הוראה עבור משימה זו</h2>
              <button className={styles.dialogClose} onClick={() => setRenameTarget(null)}>
                ✕
              </button>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>כותרת חלופית (השאר ריק לשימוש בכותרת המקורית)</label>
              <input
                type="text"
                className={styles.input}
                value={renameTitleInput}
                onChange={(e) => setRenameTitleInput(e.target.value)}
                placeholder="הזן כותרת חלופית…"
                autoFocus
              />
            </div>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setRenameTarget(null)} className={styles.removeButton}>
                ביטול
              </button>
              <button type="button" onClick={handleRenameSave} className={styles.submitButton}>
                שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
