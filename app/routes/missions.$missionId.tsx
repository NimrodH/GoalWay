import { useState, useEffect, useRef } from "react";
import { data, redirect, Link, useNavigate, useLocation, useSearchParams, useFetcher } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown, List, ListX, GitBranch, StickyNote, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import styles from "./missions.$missionId.module.css";
import { getMissionById, getAllMissions, checkMissionAccess } from "~/services/missions.server";
import { getInstructionsByIds } from "~/services/instructions.server";
import { getUserProfile, isAdmin } from "~/lib/auth.server";
import { useAuth } from "~/hooks/use-auth";
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

  // Load admin notes and all instruction IDs only in preview mode (admin context)
  let adminNotes: string[] = [];
  let allInstructionIds: string[] = [];
  if (isPreview) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);
    const [notesResult, instrIdsResult] = await Promise.all([
      supabase.from("missions").select("admin_notes").eq("id", params.missionId).single(),
      supabase.from("instructions").select("id").order("created_at", { ascending: true }),
    ]);
    adminNotes = Array.isArray(notesResult.data?.admin_notes) ? notesResult.data.admin_notes : [];
    allInstructionIds = (instrIdsResult.data || []).map((r: { id: string }) => r.id);
  }

  return { mission, instructions, allMissions, isPreview, adminNotes, allInstructionIds };
}

type MissionStatus = "Hide" | "For all" | "Only Adama" | "Only Bazn";
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

export default function MissionPage({ loaderData, params }: Route.ComponentProps) {
  const { mission, instructions, allMissions, isPreview, adminNotes: initialAdminNotes, allInstructionIds } = loaderData;
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
  const currentStatus = (statusFetcher.formData?.get("status") as MissionStatus | undefined) ?? mission.status ?? "For all";

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
        <>
          <div className={styles.previewBar}>
            <button
              onClick={() => navigate(`/admin/missions?missionId=${params.missionId}`)}
              className={styles.menuLink}
            >
              <ArrowLeft size={18} />
              Back to Admin
            </button>

            {/* Notes toggle button */}
            <button
              className={`${styles.menuLink} ${notesOpen ? styles.menuLinkActive : ""}`}
              onClick={() => {
                setNotesOpen((v) => !v);
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
