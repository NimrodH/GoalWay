import { useState, useEffect, useRef } from "react";
import { data, redirect, Link, useNavigate, useLocation, useSearchParams, useFetcher } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown, GitBranch, StickyNote, Plus, Pencil, Trash2, Check, X, BookMarked } from "lucide-react";
import styles from "./missions.$missionId.module.css";
import { getMissionById, getAllMissions, checkMissionAccess } from "~/services/missions.server";
import { getInstructionsByIds } from "~/services/instructions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import { useAuth } from "~/hooks/use-auth";
import type { Instruction } from "~/data/instructions";
import { MISSION_STATUSES, normalizeMissionStatus, type MissionStatus, VALID_MISSION_STATUSES } from "~/data/mission-constants";

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

  // Load admin notes and all instruction IDs only in preview mode (admin context)
  let adminNotes: string[] = [];
  let allInstructionIds: string[] = [];
  let allInstructionsList: { id: string; title: string }[] = [];
  if (isPreview) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
    const [notesResult, instrResult] = await Promise.all([
      supabase.from("missions").select("admin_notes").eq("id", params.missionId).single(),
      supabase.from("instructions").select("id, data_en").order("created_at", { ascending: true }),
    ]);
    adminNotes = Array.isArray(notesResult.data?.admin_notes) ? notesResult.data.admin_notes : [];
    allInstructionIds = (instrResult.data || []).map((r: { id: string }) => r.id);
    allInstructionsList = (instrResult.data || []).map((r: { id: string; data_en?: { title?: string } }) => ({
      id: r.id,
      title: r.data_en?.title || r.id,
    }));
  }

  return { mission, instructions, allMissions, isPreview, adminNotes, allInstructionIds, allInstructionsList };
}

type InstructionStatus = "only title" | "partial explanation" | "full explanation";

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "saveMissionAdminNote") {
    // Always use params.missionId (the actual DB row ID) — the mission.id inside
    // data_en JSON may differ from the DB row id and would cause a silent no-op update.
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
      // Use an authenticated client so RLS UPDATE policies allow the write.
      // The anon client is silently blocked by RLS on the `missions` table.
      const supabase = createClient(
        process.env.SUPABASE_PROJECT_URL!,
        process.env.SUPABASE_API_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        },
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

type ElseEntry = {
  id: string;
  title: string;
  description: string;
  status: "else";
  type: "else";
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
  | ElseEntry
  | TempEntry;

type LinkedMissionExpansion = {
  instructions: MissionInstruction[];
  rawInstructions: [string, string?][];
  parentOf: Map<string, string>;
  childrenOf: Map<string, string[]>;
  elseChildrenOf: Map<string, string[]>;
  elseIdOf: Map<string, string>;
  depthOf: Map<string, number>;
  insideIfBlock: Set<string>;
};

function buildLinkedMissionData(
  rawInstructions: [string, string?][],
  dbInstructions: Instruction[]
): LinkedMissionExpansion {
  const instructions = rawInstructions
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
      const instruction = dbInstructions.find((inst) => inst.id === baseId);
      if (!instruction) return null;
      const resolved = customTitle ? { ...instruction, title: customTitle } : instruction;
      return id !== baseId ? { ...resolved, id } : resolved;
    })
    .filter(Boolean) as MissionInstruction[];

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const elseChildrenOf = new Map<string, string[]>();
  const elseIdOf = new Map<string, string>();
  const depthOf = new Map<string, number>();
  const stack: string[] = [];
  const inElseBranch = new Set<string>();

  for (const [id] of rawInstructions) {
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
      // Validate the end-if ID against the stack top. A mismatched ID (data
      // corruption) must not blindly pop the wrong IF block.
      const expectedIfId = "if-" + id.slice("end-if-".length);
      if (stack.length > 0) {
        if (stack[stack.length - 1] === expectedIfId) {
          // Perfect match — close this block normally
          const closed = stack.pop()!;
          inElseBranch.delete(closed);
        } else {
          // ID mismatch — search the stack for the matching if-
          const matchIdx = stack.lastIndexOf(expectedIfId);
          if (matchIdx !== -1) {
            // Pop everything from matchIdx to end (closing all nested blocks)
            const removed = stack.splice(matchIdx);
            for (const r of removed) inElseBranch.delete(r);
          }
          // If not in stack at all, this end-if is orphaned — skip it
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

  return {
    instructions,
    rawInstructions,
    parentOf,
    childrenOf,
    elseChildrenOf,
    elseIdOf,
    depthOf,
    insideIfBlock: new Set<string>(parentOf.keys()),
  };
}

export default function MissionPage({ loaderData, params }: Route.ComponentProps) {
  const { mission, instructions, allMissions, isPreview, adminNotes: initialAdminNotes, allInstructionIds, allInstructionsList } = loaderData;
  const { session } = useAuth();
  const statusFetcher = useFetcher();
  // Fetchers for converting temp instructions to real ones (preview mode)
  const createAndEditFetcher = useFetcher<{ success: boolean; error?: string; newInstructionId?: string }>();
  const saveMissionAfterCreateFetcher = useFetcher<{ success: boolean; error?: string }>();
  const [pendingTempEdit, setPendingTempEdit] = useState<{ tempId: string; title: string } | null>(null);
  const [pendingNavigateToInstructionId, setPendingNavigateToInstructionId] = useState<string | null>(null);
  // Optimistic: track which temp IDs have been converted (so the edit row can show "Creating...")
  const convertingTempId = pendingTempEdit?.tempId ?? null;
  // Optimistic status — show the pending value immediately while saving
  const currentStatus = normalizeMissionStatus(
    (statusFetcher.formData?.get("status") as MissionStatus | undefined) ?? mission.status,
  );

  // Watch for createAndEditFetcher completion — replace temp ID in mission + save
  useEffect(() => {
    if (createAndEditFetcher.data && createAndEditFetcher.state === "idle" && pendingTempEdit) {
      const result = createAndEditFetcher.data;
      if (result.success && result.newInstructionId) {
        const newId = result.newInstructionId;
        const { tempId } = pendingTempEdit;
        setPendingTempEdit(null);
        setPendingNavigateToInstructionId(newId);

        if (session) {
          // Rebuild the mission instructions with the temp ID replaced by the real new ID
          const updatedInstructions = mission.instructions.map(([id, title]) =>
            id === tempId ? ([newId, title] as [string, string?]) : ([id, title] as [string, string?])
          );
          const updatedMission = {
            id: mission.id,
            title: mission.title,
            description: mission.description,
            instructions: updatedInstructions,
            status: mission.status,
          };
          const fd = new FormData();
          fd.append("actionType", "saveMission");
          fd.append("id", mission.id);
          fd.append("dataEn", JSON.stringify(updatedMission));
          fd.append("language", "en");
          fd.append("accessToken", session.access_token || "");
          saveMissionAfterCreateFetcher.submit(fd, { method: "post", action: "/admin" });
        } else {
          // No session — navigate directly without saving
          window.location.href = `/admin/instructions?instructionId=${newId}`;
        }
      } else if (result.error) {
        alert(`Failed to create instruction: ${result.error}`);
        setPendingTempEdit(null);
      }
    }
  }, [createAndEditFetcher.data, createAndEditFetcher.state, pendingTempEdit]);

  // Watch for saveMissionAfterCreateFetcher completion — navigate to admin/instructions
  useEffect(() => {
    if (
      saveMissionAfterCreateFetcher.data &&
      saveMissionAfterCreateFetcher.state === "idle" &&
      pendingNavigateToInstructionId
    ) {
      const instructionId = pendingNavigateToInstructionId;
      setPendingNavigateToInstructionId(null);
      if (!saveMissionAfterCreateFetcher.data.success) {
        console.warn("Mission save after temp create had an error:", saveMissionAfterCreateFetcher.data.error);
      }
      window.location.href = `/admin/instructions?instructionId=${instructionId}`;
    }
  }, [saveMissionAfterCreateFetcher.data, saveMissionAfterCreateFetcher.state, pendingNavigateToInstructionId]);

  /** Convert a temporary instruction entry (T1, T2…) to a real instruction and open it for editing */
  const handleEditTempInstruction = (tempId: string, tempTitle: string) => {
    if (!session) {
      alert("You must be signed in to create instructions");
      return;
    }
    const numericIds = (allInstructionIds ?? []).map((id: string) => parseInt(id, 10)).filter((n: number) => !isNaN(n));
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const newInstructionId = String(maxId + 1);

    setPendingTempEdit({ tempId, title: tempTitle });

    const fd = new FormData();
    fd.append("actionType", "createInstruction");
    fd.append("newId", newInstructionId);
    fd.append("language", "en");
    fd.append("accessToken", session.access_token || "");
    createAndEditFetcher.submit(fd, { method: "post", action: "/admin" });
  };

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
      // ELSE branch separator
      if (id.startsWith("else-")) {
        return {
          id,
          title: customTitle || "ELSE",
          description: "",
          status: "else" as const,
          type: "else" as const,
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
    .filter(Boolean) as (NonNullable<ReturnType<typeof instructions["find"]>> | CommentEntry | IfEntry | EndIfEntry | ElseEntry | TempEntry)[];

  // Build nested IF/ELSE structure using a stack-based parser.
  // parentOf: every id -> the ifId of the immediately-enclosing IF block (if any)
  // childrenOf: ifId -> direct IF-branch children ids
  // elseChildrenOf: ifId -> direct ELSE-branch children ids
  // elseIdOf: ifId -> the else- entry id (if it has an ELSE)
  // depthOf: ifId -> nesting depth (0 = top-level)
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const elseChildrenOf = new Map<string, string[]>();
  const elseIdOf = new Map<string, string>(); // ifId -> elseId
  const depthOf = new Map<string, number>();
  (() => {
    const stack: string[] = []; // stack of open ifIds
    const inElseBranch = new Set<string>(); // set of ifIds currently in their else branch
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
        // Switch the top-of-stack IF into its else branch
        if (stack.length > 0) {
          const ifId = stack[stack.length - 1];
          inElseBranch.add(ifId);
          elseIdOf.set(ifId, id);
          // The else- entry itself is a child of its enclosing IF (for hiding purposes)
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

  // Derive the full set of IDs inside any IF block (regardless of expanded/collapsed state)
  const insideIfBlock = new Set<string>(parentOf.keys());

  // Instructions panel state (preview mode only)
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const [instructionSearch, setInstructionSearch] = useState("");

  // Admin notes panel state (preview mode only)
  const [notesOpen, setNotesOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState<string[]>(initialAdminNotes ?? []);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const adminNotesFetcher = useFetcher<{ success: boolean; error?: string }>();
  const newNoteInputRef = useRef<HTMLTextAreaElement>(null);
  // Track pending save to avoid overwriting optimistic state on revalidation
  const pendingSaveRef = useRef<string[] | null>(null);

  // Sync local adminNotes from loader data after each route revalidation,
  // but only when there is no in-flight save (to avoid overwriting optimistic state).
  useEffect(() => {
    if (adminNotesFetcher.state === "idle" && pendingSaveRef.current === null) {
      setAdminNotes(initialAdminNotes ?? []);
    }
  }, [initialAdminNotes]);

  // Once the fetcher goes idle after a save, clear the pending ref so
  // the next revalidation can sync again normally.
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
    // Include the admin's access token so the server action can authenticate the
    // Supabase write — RLS UPDATE policies block the anon client silently.
    fd.set("accessToken", session?.access_token || "");
    // Always use params.missionId (the actual DB row ID) — mission.id from the JSON
    // data may differ and would cause a silent no-op update to the wrong row.
    adminNotesFetcher.submit(fd, { method: "post", action: `/missions/${params.missionId}` });
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
  // Tracks selected instruction inside each expanded sub-mission, keyed by the parent link instruction id
  const [selectedLinkedInstructionId, setSelectedLinkedInstructionId] = useState<Map<string, string | null>>(new Map());
  const [expandedLinkInstructions, setExpandedLinkInstructions] = useState<Map<string, LinkedMissionExpansion>>(new Map());
  const [linkedExpandedIfBlocks, setLinkedExpandedIfBlocks] = useState<Map<string, Map<string, "if" | "else">>>(new Map());
  const [loadingLinkInstructions, setLoadingLinkInstructions] = useState<Set<string>>(new Set());
  const [completedInstructions, setCompletedInstructions] = useState<Set<string>>(new Set());
  // Map<ifId, 'if' | 'else'> — tracks which branch is active (null/missing = collapsed)
  const [expandedIfBlocks, setExpandedIfBlocks] = useState<Map<string, "if" | "else">>(new Map());

  // An item is hidden when its parent IF block is collapsed, or it belongs to the
  // non-active branch. The else- separator row itself is always hidden.
  const hiddenByIf = new Set<string>();
  for (const [ifId, children] of childrenOf) {
    const activeBranch = expandedIfBlocks.get(ifId);
    if (!activeBranch) {
      // Collapsed — hide all IF-branch and ELSE-branch children
      for (const id of children) hiddenByIf.add(id);
      for (const id of elseChildrenOf.get(ifId) ?? []) hiddenByIf.add(id);
    } else if (activeBranch === "if") {
      // Showing IF branch — hide ELSE-branch children
      for (const id of elseChildrenOf.get(ifId) ?? []) hiddenByIf.add(id);
    } else {
      // Showing ELSE branch — hide IF-branch children (but not the else- row itself)
      for (const id of children) {
        const elseId = elseIdOf.get(ifId);
        if (id !== elseId) hiddenByIf.add(id);
      }
    }
  }

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
    setExpandedIfBlocks((prev) => {
      const next = new Map(prev);
      const isCollapsing = next.get(ifId) === branch;

      if (isCollapsing) {
        // Collapse this block
        next.delete(ifId);
      } else {
        // Switch to the new branch
        next.set(ifId, branch);
      }

      // In either case, collapse all nested IF blocks inside this one
      for (const descendantId of collectDescendantIfIds(ifId)) {
        next.delete(descendantId);
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
      setLinkedExpandedIfBlocks((prev) => {
        const next = new Map(prev);
        next.delete(instructionId);
        return next;
      });
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

        const expansion = buildLinkedMissionData(linkedMission.instructions, linkedInstructions);

        const newMap = new Map(expandedLinkInstructions);
        newMap.set(instructionId, expansion);
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

  const toggleLinkedIfBlock = (parentLinkId: string, ifId: string, branch: "if" | "else" = "if") => {
    const expansion = expandedLinkInstructions.get(parentLinkId);
    setLinkedExpandedIfBlocks((prev) => {
      const next = new Map(prev);
      const linkBlocks = new Map(next.get(parentLinkId) ?? []);
      const isCollapsing = linkBlocks.get(ifId) === branch;
      if (isCollapsing) {
        linkBlocks.delete(ifId);
      } else {
        linkBlocks.set(ifId, branch);
      }
      if (expansion) {
        const collectLinkedDescendants = (id: string): string[] => {
          const result: string[] = [];
          const queue = [...(expansion.childrenOf.get(id) ?? []), ...(expansion.elseChildrenOf.get(id) ?? [])];
          while (queue.length > 0) {
            const cid = queue.shift()!;
            if (cid.startsWith("if-")) {
              result.push(cid);
              queue.push(...(expansion.childrenOf.get(cid) ?? []));
              queue.push(...(expansion.elseChildrenOf.get(cid) ?? []));
            }
          }
          return result;
        };
        for (const descendantId of collectLinkedDescendants(ifId)) {
          linkBlocks.delete(descendantId);
        }
      }
      next.set(parentLinkId, linkBlocks);
      return next;
    });
  };

  const handleLinkedInstructionClick = (parentLinkId: string, linkedInstruction: MissionInstruction, event?: React.MouseEvent) => {
    // Non-interactive entry types — delegate IF toggle, skip others
    if ("type" in linkedInstruction) {
      if (linkedInstruction.type === "if") {
        toggleLinkedIfBlock(parentLinkId, linkedInstruction.id, "if");
        return;
      }
      if (
        linkedInstruction.type === "comment" ||
        linkedInstruction.type === "else" ||
        linkedInstruction.type === "end-if" ||
        linkedInstruction.type === "temp"
      ) {
        return;
      }
    }

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
      navigate(`/missions/${previousMissionId}`);
    } else {
      navigate("/");
    }
  };

  const selectedInstruction = missionInstructions.find((inst) => inst?.id === selectedInstructionId) || null;

  // An instruction has expandable content (shows an indicator) when it is a link type
  // or has at least one explanation item — mirrors InstructionListItem's getIndicator() logic.
  const selectedInstructionHasContent = selectedInstruction
    ? (("type" in selectedInstruction && selectedInstruction.type === "link") ||
        ("explanation" in selectedInstruction &&
          Array.isArray((selectedInstruction as { explanation?: unknown[] }).explanation) &&
          ((selectedInstruction as { explanation?: unknown[] }).explanation?.length ?? 0) > 0))
    : false;

  // Don't pass comments, IF, ELSE, or temp entries to ExplanationDisplay
  const instructionToDisplay =
    selectedInstruction &&
    "type" in selectedInstruction &&
    (selectedInstruction.type === "comment" || selectedInstruction.type === "if" || selectedInstruction.type === "else" || selectedInstruction.type === "temp")
      ? null
      : selectedInstruction;

  // Helper: sum the heights of all sticky headers so we can offset the scroll target,
  // ensuring the clicked item row itself (not just its content) appears at the top.
  const getStickyHeaderOffset = () => {
    let offset = 0;
    document.querySelectorAll<HTMLElement>("[data-sticky-header]").forEach((el) => {
      offset += el.getBoundingClientRect().height;
    });
    return offset;
  };

  // Scroll selected master-mission instruction to top after render —
  // but only when the instruction actually has content to expand (has an indicator).
  useEffect(() => {
    if (selectedInstructionId && selectedInstructionHasContent) {
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-instruction-id="${selectedInstructionId}"]`);
        if (element) {
          const top = element.getBoundingClientRect().top + window.scrollY - getStickyHeaderOffset();
          window.scrollTo({ top, behavior: "smooth" });
        }
      });
    }
  }, [selectedInstructionId, selectedInstructionHasContent]);

  // Scroll selected sub-mission instruction to top after render
  useEffect(() => {
    for (const [parentId, linkedId] of selectedLinkedInstructionId) {
      if (linkedId) {
        requestAnimationFrame(() => {
          const element = document.querySelector(`[data-instruction-id="linked-${parentId}-${linkedId}"]`);
          if (element) {
            const top = element.getBoundingClientRect().top + window.scrollY - getStickyHeaderOffset();
            window.scrollTo({ top, behavior: "smooth" });
          }
        });
        break;
      }
    }
  }, [selectedLinkedInstructionId]);

  // Compute per-linked-mission IF/ELSE visibility state
  const linkedMissionIfStates = new Map<string, { hiddenByIf: Set<string>; linkIfBlocks: Map<string, "if" | "else"> }>();
  for (const [parentLinkId, expansion] of expandedLinkInstructions) {
    const linkIfBlocks = linkedExpandedIfBlocks.get(parentLinkId) ?? new Map<string, "if" | "else">();
    const linkedHiddenByIf = new Set<string>();
    for (const [ifId, children] of expansion.childrenOf) {
      const activeBranch = linkIfBlocks.get(ifId);
      if (!activeBranch) {
        for (const id of children) linkedHiddenByIf.add(id);
        for (const id of expansion.elseChildrenOf.get(ifId) ?? []) linkedHiddenByIf.add(id);
      } else if (activeBranch === "if") {
        for (const id of expansion.elseChildrenOf.get(ifId) ?? []) linkedHiddenByIf.add(id);
      } else {
        for (const id of children) {
          const elseId = expansion.elseIdOf.get(ifId);
          if (id !== elseId) linkedHiddenByIf.add(id);
        }
      }
    }
    linkedMissionIfStates.set(parentLinkId, { hiddenByIf: linkedHiddenByIf, linkIfBlocks });
  }

  return (
    <>
      {isPreview && (
        <>
          <div className={styles.previewBar} data-sticky-header>
            <button
              onClick={() => navigate(`/admin/missions?missionId=${params.missionId}`)}
              className={styles.menuLink}
            >
              <ArrowLeft size={18} />
              Back to Admin
            </button>

            {/* Instructions toggle button */}
            <button
              className={`${styles.menuLink} ${instructionsOpen ? styles.menuLinkActive : ""}`}
              onClick={() => {
                setInstructionsOpen((v) => !v);
                if (notesOpen) setNotesOpen(false);
              }}
              aria-pressed={instructionsOpen}
              title="Show / hide all available instructions"
            >
              <BookMarked size={15} />
              Instructions
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
                if (!notesOpen) {
                  setTimeout(() => newNoteInputRef.current?.focus(), 80);
                }
              }}
              aria-pressed={notesOpen}
              title="Show / hide author notes for this mission"
            >
              <StickyNote size={15} />
              Notes
              {adminNotes.length > 0 && (
                <span className={styles.notesBadge}>{adminNotes.length}</span>
              )}
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
                {MISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {statusFetcher.state !== "idle" && (
                <span className={styles.statusSaving}>Saving…</span>
              )}
              {statusFetcher.state === "idle" && statusFetcher.data?.success === true && (
                <span className={styles.statusSaved}>✓ Saved</span>
              )}
            </statusFetcher.Form>
          </div>

          {/* Instructions panel — shown below the preview bar */}
          {instructionsOpen && (
            <div className={styles.notesPanel}>
              <div className={styles.notesPanelHeader}>
                <span className={styles.notesPanelTitle}>
                  <BookMarked size={14} /> All Instructions
                  {allInstructionsList && allInstructionsList.length > 0 && ` (${allInstructionsList.length})`}
                </span>
              </div>
              <input
                className={styles.instructionsSearchInput}
                type="text"
                placeholder="Search by ID or title…"
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
                        title={`Open instruction ${instr.id} in admin`}
                      >
                        {instr.title}
                      </button>
                    </li>
                  ))}
                {(allInstructionsList ?? []).filter((instr) => {
                  const q = instructionSearch.toLowerCase();
                  return !q || instr.id.toLowerCase().includes(q) || instr.title.toLowerCase().includes(q);
                }).length === 0 && (
                  <li className={styles.notesEmpty}>No instructions match your search.</li>
                )}
              </ul>
            </div>
          )}

          {/* Admin notes panel — shown below the preview bar */}
          {notesOpen && (
            <div className={styles.notesPanel}>
              <div className={styles.notesPanelHeader}>
                <span className={styles.notesPanelTitle}>
                  <StickyNote size={14} /> Author Notes
                  {adminNotes.length > 0 && ` (${adminNotes.length})`}
                </span>
                {adminNotesFetcher.state !== "idle" && (
                  <span className={styles.statusSaving}>Saving…</span>
                )}
                {adminNotesFetcher.state === "idle" && adminNotesFetcher.data?.success === true && (
                  <span className={styles.statusSaved}>✓ Saved</span>
                )}
                {adminNotesFetcher.state === "idle" && adminNotesFetcher.data?.success === false && (
                  <span className={styles.statusSaving} style={{ color: "var(--color-error-11)" }}>
                    ⚠ {adminNotesFetcher.data.error || "Save failed"}
                  </span>
                )}
              </div>

              {/* Existing notes */}
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
                            <button
                              className={styles.noteActionBtn}
                              onClick={handleSaveEdit}
                              disabled={!editingNoteText.trim()}
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className={styles.noteActionBtn}
                              onClick={handleCancelEdit}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.noteViewRow}>
                          <span className={styles.noteText}>{note}</span>
                          <div className={styles.noteViewActions}>
                            <button
                              className={styles.noteActionBtn}
                              onClick={() => handleStartEdit(idx)}
                              title="Edit note"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className={`${styles.noteActionBtn} ${styles.noteDeleteBtn}`}
                              onClick={() => handleRemoveNote(idx)}
                              title="Delete note"
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
                <p className={styles.notesEmpty}>No notes yet. Add the first one below.</p>
              )}

              {/* New note input */}
              <div className={styles.notesAddRow}>
                <textarea
                  ref={newNoteInputRef}
                  className={styles.noteTextarea}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a note… (Ctrl+Enter to save)"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                <button
                  className={styles.notesAddBtn}
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim()}
                  title="Add note"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <div className={styles.container}>
        <section className={styles.instructionListSection}>
          <div className={styles.headerWrapper} data-sticky-header>
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
              // The else- separator row is always hidden from the UI (it's rendered as part of the IF row)
              if (isElse) return null;

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
                    if ("type" in inst) return inst.type !== "comment" && inst.type !== "if" && inst.type !== "end-if" && inst.type !== "else";
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

              // Render IF block toggle (with optional ELSE side-by-side)
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
                    style={depth > 0 ? { paddingLeft: `calc(${depth} * var(--space-5))` } : undefined}
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
                        className={`${styles.ifBlockButton} ${depth > 0 ? styles.ifBlockButtonNested : ""} ${isIfExpanded ? styles.ifBranchActive : ""}`}
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

              // Render END-IF divider only when its matching IF block is expanded
              if (isEndIf) {
                // Derive the matching IF id: "end-if-X" -> "if-X"
                const matchingIfId = instruction.id.replace(/^end-if-/, "if-");
                if (!expandedIfBlocks.has(matchingIfId)) return null;
                return <div key={instruction.id} className={styles.endIfDivider} aria-hidden="true" />;
              }


              // Indent regular instructions inside nested IF blocks
              const instrDepth = (() => {
                let p = parentOf.get(instruction.id);
                let d = 0;
                while (p) { d++; p = parentOf.get(p); }
                return d;
              })();

              return (
                <div
                  key={instruction.id}
                  style={instrDepth > 0 ? { paddingLeft: `calc(${instrDepth} * var(--space-5))` } : undefined}
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
                    {isPreview && (
                      <div className={styles.editInstructionRow}>
                        <span className={styles.instructionIdBadge} title="Instruction ID" style={{ marginRight: "auto" }}>
                          ID: {instruction.id}
                        </span>
                        <button
                          className={styles.editInstructionButton}
                          disabled={isTemp && convertingTempId === instruction.id}
                          onClick={() => {
                            if (isTemp) {
                              handleEditTempInstruction(
                                instruction.id,
                                ("title" in instruction ? instruction.title : "") || "",
                              );
                            } else {
                              // Strip the duplicate-occurrence suffix before navigating to admin
                              const editId = instruction.id.includes("#") ? instruction.id.split("#")[0] : instruction.id;
                              navigate(`/admin/instructions?instructionId=${editId}`);
                            }
                          }}
                          title={isTemp ? `Create real instruction from ${instruction.id} and edit it` : `Edit instruction ${instruction.id}`}
                        >
                          {isTemp && convertingTempId === instruction.id ? "Creating…" : "✏️ Edit ^"}
                        </button>
                        {!isTemp && (
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
                        )}
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
                          <ExplanationDisplay instruction={instruction as Instruction} captionVisible={true} />
                        </div>
                      )}
                  </div>

                  {/* Render expanded linked mission instructions */}
                  {isLinkExpanded && expandedInstructions && (() => {
                    const linkedState = linkedMissionIfStates.get(instruction.id) ?? {
                      hiddenByIf: new Set<string>(),
                      linkIfBlocks: new Map<string, "if" | "else">(),
                    };
                    let linkedOrderCounter = 0;
                    return (
                      <div style={{ marginLeft: "2rem", marginTop: "0.5rem", marginBottom: "1rem" }}>
                        {expandedInstructions.instructions.map((linkedInstruction) => {
                          const lid = linkedInstruction.id;
                          const isLinkedComment = "type" in linkedInstruction && linkedInstruction.type === "comment";
                          const isLinkedIf = "type" in linkedInstruction && linkedInstruction.type === "if";
                          const isLinkedEndIf = "type" in linkedInstruction && linkedInstruction.type === "end-if";
                          const isLinkedElse = "type" in linkedInstruction && linkedInstruction.type === "else";
                          const isLinkedTemp = "type" in linkedInstruction && linkedInstruction.type === "temp";

                          // Else separator is rendered as part of the IF row
                          if (isLinkedElse) return null;
                          // Hidden by a collapsed IF block
                          if (linkedState.hiddenByIf.has(lid)) return null;

                          if (!isLinkedComment && !isLinkedIf && !isLinkedEndIf && !isLinkedElse) {
                            linkedOrderCounter++;
                          }
                          const linkedOrderNumber = linkedOrderCounter;

                          const linkedSelected = selectedLinkedInstructionId.get(instruction.id) === lid;
                          const linkedActiveBranch = isLinkedIf ? linkedState.linkIfBlocks.get(lid) : undefined;
                          const linkedIsIfExpanded = isLinkedIf && linkedActiveBranch !== undefined;
                          const linkedDepth = expandedInstructions.depthOf.get(lid) ?? 0;
                          const linkedInstrDepth = (() => {
                            let p = expandedInstructions.parentOf.get(lid);
                            let d = 0;
                            while (p) { d++; p = expandedInstructions.parentOf.get(p); }
                            return d;
                          })();

                          // ---- Comment ----
                          if (isLinkedComment) {
                            return (
                              <div key={`${instruction.id}-${lid}`} className={styles.instructionItem}>
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
                                    <Markdown remarkPlugins={[remarkBreaks]}>{linkedInstruction.title}</Markdown>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // ---- IF block toggle ----
                          if (isLinkedIf) {
                            const linkedElseId = expandedInstructions.elseIdOf.get(lid);
                            const hasLinkedElse = Boolean(linkedElseId);
                            const linkedElseEntry = hasLinkedElse
                              ? expandedInstructions.instructions.find((m) => m && "type" in m && m.type === "else" && m.id === linkedElseId)
                              : null;
                            const linkedElseTitle = linkedElseEntry && "title" in linkedElseEntry ? linkedElseEntry.title : "ELSE";
                            return (
                              <div
                                key={`${instruction.id}-${lid}`}
                                className={styles.instructionItem}
                                data-instruction-id={`linked-${instruction.id}-${lid}`}
                                style={linkedDepth > 0 ? { paddingLeft: `calc(${linkedDepth} * var(--space-5))` } : undefined}
                              >
                                {hasLinkedElse ? (
                                  <div className={styles.ifElseRow}>
                                    <button
                                      onClick={() => toggleLinkedIfBlock(instruction.id, lid, "if")}
                                      className={`${styles.ifBlockButton} ${styles.ifElseHalf} ${linkedDepth > 0 ? styles.ifBlockButtonNested : ""} ${linkedActiveBranch === "if" ? styles.ifBranchActive : ""}`}
                                      aria-expanded={linkedActiveBranch === "if"}
                                    >
                                      <GitBranch size={linkedDepth > 0 ? 15 : 18} className={styles.ifBlockIcon} />
                                      <span className={styles.ifBlockTitle}>{linkedInstruction.title}</span>
                                      {linkedActiveBranch === "if" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    <button
                                      onClick={() => toggleLinkedIfBlock(instruction.id, lid, "else")}
                                      className={`${styles.ifBlockButton} ${styles.ifElseHalf} ${styles.elseBlockButton} ${linkedDepth > 0 ? styles.ifBlockButtonNested : ""} ${linkedActiveBranch === "else" ? styles.elseBranchActive : ""}`}
                                      aria-expanded={linkedActiveBranch === "else"}
                                    >
                                      <GitBranch size={linkedDepth > 0 ? 15 : 18} className={styles.ifBlockIcon} />
                                      <span className={styles.ifBlockTitle}>{linkedElseTitle}</span>
                                      {linkedActiveBranch === "else" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => toggleLinkedIfBlock(instruction.id, lid, "if")}
                                    className={`${styles.ifBlockButton} ${linkedDepth > 0 ? styles.ifBlockButtonNested : ""}`}
                                    aria-expanded={linkedIsIfExpanded}
                                  >
                                    <GitBranch size={linkedDepth > 0 ? 15 : 18} className={styles.ifBlockIcon} />
                                    <span className={styles.ifBlockTitle}>{linkedInstruction.title}</span>
                                    {linkedIsIfExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                )}
                              </div>
                            );
                          }

                          // ---- END-IF divider ----
                          if (isLinkedEndIf) {
                            const matchingIfId = lid.replace(/^end-if-/, "if-");
                            if (!linkedState.linkIfBlocks.has(matchingIfId)) return null;
                            return <div key={`${instruction.id}-${lid}`} className={styles.endIfDivider} aria-hidden="true" />;
                          }

                          // ---- Regular / temp instruction ----
                          return (
                            <div
                              key={`${instruction.id}-${lid}`}
                              style={linkedInstrDepth > 0 ? { paddingLeft: `calc(${linkedInstrDepth} * var(--space-5))` } : undefined}
                            >
                              <div
                                className={styles.instructionItem}
                                data-instruction-id={`linked-${instruction.id}-${lid}`}
                              >
                                <InstructionListItem
                                  title={linkedInstruction.title}
                                  description={linkedInstruction.description}
                                  selected={linkedSelected}
                                  instructionType={"type" in linkedInstruction && linkedInstruction.type !== "temp" ? linkedInstruction.type : undefined}
                                  explanation={linkedInstruction.explanation as Instruction["explanation"]}
                                  orderNumber={linkedOrderNumber}
                                  isCompleted={completedInstructions.has(lid)}
                                  isInsideIfBlock={expandedInstructions.insideIfBlock.has(lid)}
                                  onClick={(event) => handleLinkedInstructionClick(instruction.id, linkedInstruction, event)}
                                />
                                {linkedSelected && !isLinkedTemp &&
                                  ("type" in linkedInstruction ? linkedInstruction.type !== "link" : true) &&
                                  Array.isArray(linkedInstruction.explanation) &&
                                  (linkedInstruction.explanation as unknown[]).length > 0 && (
                                  <div className={styles.mobileExplanation}>
                                    <ExplanationDisplay instruction={linkedInstruction as Instruction} captionVisible={true} />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.explanationSection}>
          <ExplanationDisplay instruction={instructionToDisplay as Instruction | null} className={styles.explanationContainer} captionVisible={true} />
        </section>
      </div>
    </>
  );
}
