import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { AdminLayout } from "~/components/admin-layout/admin-layout";
import { useAuth } from "~/hooks/use-auth";
import classNames from "classnames";
import styles from "./admin.module.css";
import { loader as adminLoader, action as adminAction } from "~/routes/admin";
import type { Instruction } from "~/services/instructions.server";
import type { Mission } from "~/services/missions.server";
import styles0 from "./admin.missions.module.css";
import { DrawioUploadDialog } from "~/components/drawio-upload-dialog/drawio-upload-dialog";

export const loader = adminLoader;
export const action = adminAction;

export default function AdminMissionsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AdminLayout loaderData={loaderData} activeSection="missions">
      {({ onChangesDetected, onNavigationRequest, clearActionData }) => (
        <EditMissionForm
          actionData={actionData}
          clearActionData={clearActionData}
          instructions={loaderData.instructions}
          missions={loaderData.missions}
          allMissionsHe={loaderData.allMissionsHe}
          allMissionIds={loaderData.allMissionIds}
          allInstructionIds={loaderData.allInstructionIds}
          instructionsEn={loaderData.instructionsEn}
          instructionsHe={loaderData.instructionsHe}
          language={loaderData.language}
          onChangesDetected={onChangesDetected}
          onNavigationRequest={onNavigationRequest}
          missionAdminNotesMap={loaderData.missionAdminNotesMap}
          missionsWithAccess={loaderData.missionsWithAccess}
          organizations={loaderData.organizations}
        />
      )}
    </AdminLayout>
  );
}

function AuthenticatedForm({
  actionType,
  id,
  data,
  disabled,
  language,
  isExample,
}: {
  actionType: string;
  id: string;
  data: string;
  disabled: boolean;
  language: string;
  isExample?: boolean;
}) {
  const { session } = useAuth();

  return (
    <Form method="post" preventScrollReset style={{ marginTop: "var(--space-4)" }}>
      <input type="hidden" name="actionType" value={actionType} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dataEn" value={data} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="accessToken" value={session?.access_token || ""} />
      {isExample !== undefined && <input type="hidden" name="isExample" value={String(isExample)} />}
      <button
        type="submit"
        className={styles.submitButton}
        disabled={disabled || !session}
        data-admin-primary-save="true"
        data-explanation-id="admin-mission-save-db"
      >
        Save to Database ({language === "he" ? "Hebrew" : "English"})
      </button>
    </Form>
  );
}

function EditMissionForm({
  actionData,
  clearActionData,
  instructions,
  missions,
  allMissionsHe,
  allMissionIds,
  allInstructionIds,
  instructionsEn,
  instructionsHe,
  language,
  onChangesDetected,
  onNavigationRequest,
  missionAdminNotesMap,
  missionsWithAccess,
  organizations,
}: {
  actionData?: {
    success: boolean;
    message?: string;
    error?: string;
    imageUrl?: string;
    translatedText?: string | null;
    newMissionId?: string;
  };
  clearActionData: () => void;
  instructions: Instruction[];
  missions: Mission[];
  allMissionsHe: Mission[];
  allMissionIds: string[];
  allInstructionIds: string[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
  missionAdminNotesMap: Record<string, string[]>;
  missionsWithAccess: Array<{
    id: string;
    allowedOrgIds: string[];
    instructions?: Array<[string, string?]>;
    [key: string]: unknown;
  }>;
  organizations: Array<{ id: string; name: string }>;
}) {
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Hide" | "For all" | "Only Adama" | "Only Bazn">("For all");
  const [isExample, setIsExample] = useState(false);
  const [selectedInstructions, setSelectedInstructions] = useState<Array<[string, string?]>>([]);
  const [selectedAvailableInstructions, setSelectedAvailableInstructions] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const { session } = useAuth();
  const [originalCode, setOriginalCode] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const missionFetcher = useFetcher<typeof action>();
  const deleteMissionFetcher = useFetcher<typeof action>();
  const [showNewInstructionDialog, setShowNewInstructionDialog] = useState(false);
  const [newInstructionTitle, setNewInstructionTitle] = useState("");
  const [selectedMissionInstruction, setSelectedMissionInstruction] = useState<string | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameInstructionId, setRenameInstructionId] = useState<string | null>(null);
  const [alternativeTitle, setAlternativeTitle] = useState("");
  const [instructionFilter, setInstructionFilter] = useState("");
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [commentText, setCommentText] = useState("");
  // Admin notes state
  const [adminNotes, setAdminNotes] = useState<string[]>([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const adminNotesFetcher = useFetcher<typeof action>();
  const createAndEditFetcher = useFetcher<typeof action>();
  const saveMissionAfterCreateFetcher = useFetcher<typeof action>();
  const [pendingTempEdit, setPendingTempEdit] = useState<{ tempId: string; title: string } | null>(null);
  const [pendingNavigateToInstructionId, setPendingNavigateToInstructionId] = useState<string | null>(null);
  const [pendingTempTitle, setPendingTempTitle] = useState<string>("");
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [jsonDialogInstructionId, setJsonDialogInstructionId] = useState<string | null>(null);
  const [jsonEditorValue, setJsonEditorValue] = useState("");
  const [jsonSaveError, setJsonSaveError] = useState<string | null>(null);
  const jsonFetcher = useFetcher<typeof action>();
  const duplicateMissionFetcher = useFetcher<typeof action>();
  const testModeFetcher = useFetcher<typeof action>();
  const drawioImportFetcher = useFetcher<typeof action>();
  const importBundleFetcher = useFetcher<typeof action>();
  const [codeEditorValue, setCodeEditorValue] = useState("");
  const [codeEditorError, setCodeEditorError] = useState<string | null>(null);
  const [showDrawioDialog, setShowDrawioDialog] = useState(false);
  const [collapsedIfIds, setCollapsedIfIds] = useState<Set<string>>(new Set());
  const [collapsedElseIds, setCollapsedElseIds] = useState<Set<string>>(new Set());
  const [filterMissionName, setFilterMissionName] = useState("");
  const [filterMissionDesc, setFilterMissionDesc] = useState("");
  const [filterMissionOrg, setFilterMissionOrg] = useState("");
  const [showLinkEditMenu, setShowLinkEditMenu] = useState(false);
  const linkEditMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedMissionId) {
      const currentCode = generateCode();
      if (originalCode === "") {
        setOriginalCode(currentCode);
      } else {
        onChangesDetected(currentCode !== originalCode);
      }
    }
  }, [id, title, description, status, isExample, selectedInstructions, selectedMissionId]);

  useEffect(() => {
    if (actionData?.success) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData]);

  useEffect(() => {
    if (!showLinkEditMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (linkEditMenuRef.current && !linkEditMenuRef.current.contains(e.target as Node)) {
        setShowLinkEditMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLinkEditMenu]);

  useEffect(() => {
    const missionIdFromUrl = searchParams.get("missionId");
    if (missionIdFromUrl && allMissionIds.includes(missionIdFromUrl) && missionIdFromUrl !== selectedMissionId) {
      // Only load when the URL changed externally (e.g. browser back/forward, direct link)
      // — skip when we ourselves just pushed a new missionId via setSearchParams after
      // the user picked from the dropdown (selectedMissionId is already up-to-date).
      updateMissionFormFields(missionIdFromUrl);
    } else if (!missionIdFromUrl && allMissionIds.length > 0 && !selectedMissionId) {
      const lastMissionId = localStorage.getItem("lastSelectedMissionId");
      if (lastMissionId && allMissionIds.includes(lastMissionId)) {
        updateMissionFormFields(lastMissionId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allMissionIds]);

  // Re-load form data when language changes while a mission is already selected.
  // The searchParams effect above skips reload when missionId hasn't changed —
  // but the whole point here is that the language (and therefore `missions` data) changed.
  const prevLanguageRef = useRef(language);
  useEffect(() => {
    if (prevLanguageRef.current !== language) {
      prevLanguageRef.current = language;
      if (selectedMissionId) {
        updateMissionFormFields(selectedMissionId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    const shouldScroll = localStorage.getItem("scrollToInstructions");
    if (shouldScroll === "true" && selectedMissionId) {
      localStorage.removeItem("scrollToInstructions");
      setTimeout(() => {
        const sectionTitle = Array.from(document.querySelectorAll("h2")).find((el) =>
          el.textContent?.includes("Select Instructions by Arrow"),
        );
        if (sectionTitle) {
          sectionTitle.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    }
  }, [selectedMissionId]);

  const handleAddTempInstruction = () => {
    if (!newInstructionTitle.trim()) {
      alert("Please enter a title for the new instruction");
      return;
    }

    // Find the highest existing temp ID number
    const tempIds = selectedInstructions
      .map(([id]) => id)
      .filter((id) => id.startsWith("T"))
      .map((id) => parseInt(id.slice(1), 10))
      .filter((n) => !isNaN(n));
    const nextTempNum = tempIds.length > 0 ? Math.max(...tempIds) + 1 : 1;
    const tempId = `T${nextTempNum}`;

    let updatedInstructions: Array<[string, string?]>;
    if (selectedMissionInstruction) {
      const selectedIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
      if (selectedIndex !== -1) {
        updatedInstructions = [
          ...selectedInstructions.slice(0, selectedIndex + 1),
          [tempId, newInstructionTitle.trim()],
          ...selectedInstructions.slice(selectedIndex + 1),
        ];
      } else {
        updatedInstructions = [...selectedInstructions, [tempId, newInstructionTitle.trim()]];
      }
    } else {
      updatedInstructions = [...selectedInstructions, [tempId, newInstructionTitle.trim()]];
    }

    setSelectedInstructions(updatedInstructions);
    setSelectedMissionInstruction(tempId);
    setShowNewInstructionDialog(false);
    setNewInstructionTitle("");
  };

  const handleAddIf = () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ifId = `if-${suffix}`;
    const endIfId = `end-if-${suffix}`;

    let updatedInstructions: Array<[string, string?]>;
    if (selectedMissionInstruction) {
      const selectedIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
      if (selectedIndex !== -1) {
        updatedInstructions = [
          ...selectedInstructions.slice(0, selectedIndex + 1),
          [ifId, "IF"],
          [endIfId],
          ...selectedInstructions.slice(selectedIndex + 1),
        ];
      } else {
        updatedInstructions = [...selectedInstructions, [ifId, "IF"], [endIfId]];
      }
    } else {
      updatedInstructions = [...selectedInstructions, [ifId, "IF"], [endIfId]];
    }
    setSelectedInstructions(updatedInstructions);
    setSelectedMissionInstruction(ifId);
  };

  const handleAddElse = () => {
    if (!selectedMissionInstruction) {
      alert("Select an IF, instruction inside an IF block, or END-IF first");
      return;
    }

    const selId = selectedMissionInstruction;
    let targetIfIndex = -1;
    let targetEndIfIndex = -1;

    if (selId.startsWith("if-")) {
      // Selected is an IF row — that's the target
      const suffix = selId.replace(/^if-/, "");
      targetIfIndex = selectedInstructions.findIndex(([id]) => id === selId);
      targetEndIfIndex = selectedInstructions.findIndex(([id]) => id === `end-if-${suffix}`);
    } else if (selId.startsWith("end-if-")) {
      // Selected is an END-IF row — find its matching IF by suffix
      const suffix = selId.replace(/^end-if-/, "");
      targetEndIfIndex = selectedInstructions.findIndex(([id]) => id === selId);
      targetIfIndex = selectedInstructions.findIndex(([id]) => id === `if-${suffix}`);
    } else {
      // Selected is a regular instruction, ELSE row, or comment —
      // find the INNERMOST enclosing IF by walking the list and tracking a stack.
      // When the selection is encountered, the top of the stack is the innermost IF.
      const stack: Array<{ ifId: string; ifIndex: number }> = [];
      for (let i = 0; i < selectedInstructions.length; i++) {
        const [id] = selectedInstructions[i];
        if (id.startsWith("if-")) {
          stack.push({ ifId: id, ifIndex: i });
        } else if (id.startsWith("end-if-")) {
          const suffix = id.replace(/^end-if-/, "");
          const top = stack[stack.length - 1];
          if (top && top.ifId === `if-${suffix}`) stack.pop();
        } else if (id === selId) {
          if (stack.length > 0) {
            const innermost = stack[stack.length - 1];
            targetIfIndex = innermost.ifIndex;
            const suffix = innermost.ifId.replace(/^if-/, "");
            targetEndIfIndex = selectedInstructions.findIndex(([eid]) => eid === `end-if-${suffix}`);
          }
          break;
        }
      }
    }

    if (targetIfIndex === -1 || targetEndIfIndex === -1) {
      alert("Could not find a matching IF…END-IF pair. Select the IF row, a row inside the IF block, or the END-IF row.");
      return;
    }

    const ifId = selectedInstructions[targetIfIndex][0];
    const suffix = ifId.replace(/^if-/, "");

    // Check if there's already an ELSE for this specific IF
    const existingElse = selectedInstructions
      .slice(targetIfIndex + 1, targetEndIfIndex)
      .find(([id]) => id === `else-${suffix}`);
    if (existingElse) {
      alert("This IF block already has an ELSE branch.");
      return;
    }

    // Insert ELSE just before the matching END-IF
    const elseId = `else-${suffix}`;
    const updatedInstructions = [
      ...selectedInstructions.slice(0, targetEndIfIndex),
      [elseId] as [string, string?],
      ...selectedInstructions.slice(targetEndIfIndex),
    ];
    setSelectedInstructions(updatedInstructions);
    setSelectedMissionInstruction(elseId);
  };

  const handleAddComment = () => {
    if (!commentText.trim()) {
      alert("Please enter a comment");
      return;
    }

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let updatedInstructions: Array<[string, string?]>;

    if (selectedMissionInstruction) {
      const selectedIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);

      if (selectedIndex !== -1) {
        updatedInstructions = [
          ...selectedInstructions.slice(0, selectedIndex + 1),
          [commentId, commentText.trim()],
          ...selectedInstructions.slice(selectedIndex + 1),
        ];
      } else {
        updatedInstructions = [...selectedInstructions, [commentId, commentText.trim()]];
      }
    } else {
      updatedInstructions = [...selectedInstructions, [commentId, commentText.trim()]];
    }

    setSelectedInstructions(updatedInstructions);
    setShowCommentDialog(false);
    setCommentText("");
  };

  const updateMissionFormFields = (missionId: string) => {
    setSelectedMissionId(missionId);
    setOriginalCode(""); // Reset so the next generateCode() snapshot becomes the new baseline
    localStorage.setItem("lastSelectedMissionId", missionId);
    const mission = missions.find((m) => m.id === missionId);
    if (mission) {
      setId(mission.id);
      setTitle(mission.title);
      setDescription(mission.description);
      setStatus(mission.status || "For all");
      setIsExample(mission.isExample ?? false);
      setSelectedInstructions(mission.instructions || []);
    } else {
      // No record for this language yet — fall back to English data (missionsWithAccess
      // is always built from English missions) so the user sees the mission structure
      // and can fill in the translation before saving.
      const enFallback = language === "he" ? missionsWithAccess.find((m) => m.id === missionId) : null;
      setId(missionId);
      setTitle((enFallback as Mission | undefined)?.title ?? "");
      setDescription((enFallback as Mission | undefined)?.description ?? "");
      setStatus((enFallback as Mission | undefined)?.status || "For all");
      setIsExample((enFallback as Mission | undefined)?.isExample ?? false);
      setSelectedInstructions((enFallback as Mission | undefined)?.instructions || []);
    }
    // Load admin notes for this mission
    setAdminNotes(missionAdminNotesMap[missionId] || []);
    setShowNoteInput(false);
    setNewNoteText("");
  };

  const handleSelectMission = (missionId: string) => {
    updateMissionFormFields(missionId);
    // Keep the URL ?missionId= in sync so AppNavigation's "Open Preview" button
    // always reflects the currently selected mission without a stale value.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (missionId) {
          next.set("missionId", missionId);
        } else {
          next.delete("missionId");
        }
        return next;
      },
      { replace: true },
    );
  };

  const moveInstructionUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedMissionInstruction) return;

    const index = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
    if (index <= 0) return;

    const newOrder = [...selectedInstructions];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setSelectedInstructions(newOrder);
  };

  const moveInstructionDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedMissionInstruction) return;

    const index = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
    if (index === -1 || index >= selectedInstructions.length - 1) return;

    const newOrder = [...selectedInstructions];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setSelectedInstructions(newOrder);
  };

  const generateCode = () => {
    const mission: Mission = {
      id,
      title,
      description,
      instructions: selectedInstructions,
      status,
      isExample,
    };

    return JSON.stringify(mission, null, 2);
  };

  // Sync the code editor draft whenever the form state changes from outside
  // (mission load, instruction list edits, field changes) — but NOT when the
  // user is actively typing in the editor (codeEditorValue already diverges).
  useEffect(() => {
    setCodeEditorValue(generateCode());
    setCodeEditorError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, title, description, status, isExample, selectedInstructions, selectedMissionId]);

  const handleApplyCodeEditor = () => {
    try {
      const parsed = JSON.parse(codeEditorValue);
      setId(parsed.id || "");
      setTitle(parsed.title || "");
      setDescription(parsed.description || "");
      setStatus(parsed.status || "For all");
      setIsExample(parsed.isExample ?? false);
      setSelectedInstructions(parsed.instructions || []);
      setCodeEditorError(null);
    } catch {
      setCodeEditorError("Invalid JSON — fix syntax errors before applying");
    }
  };

  /**
   * Scan the instructions array in the current JSON editor value and assign
   * #2, #3 … suffixes to any duplicate base IDs — purely in local state.
   * The user must click "Apply JSON" and then "Save to Database" to persist.
   */
  const handleFixDuplicateIds = () => {
    try {
      const parsed = JSON.parse(codeEditorValue);
      const instructions: Array<[string, string?]> = parsed.instructions || [];
      const allocatedKeys: string[] = [];
      const fixed = instructions.map(([id, title]: [string, string?]) => {
        // Only deduplicate real instruction IDs (not temp, comment, if, end-if, else)
        const isSpecial =
          (id.startsWith("T") && /^T\d+$/.test(id)) ||
          id.startsWith("comment-") ||
          id.startsWith("if-") ||
          id.startsWith("end-if-") ||
          id.startsWith("else-") ||
          id === "0";
        if (isSpecial) {
          allocatedKeys.push(id);
          return title !== undefined ? [id, title] : [id];
        }
        // Strip any existing #N suffix to get the canonical base ID
        const baseId = id.includes("#") ? id.split("#")[0] : id;
        const alreadyPresent = allocatedKeys.some((k) => k === baseId || k.startsWith(`${baseId}#`));
        let newKey: string;
        if (!alreadyPresent) {
          newKey = baseId;
        } else {
          let suffix = 2;
          while (allocatedKeys.includes(`${baseId}#${suffix}`)) suffix++;
          newKey = `${baseId}#${suffix}`;
        }
        allocatedKeys.push(newKey);
        return title !== undefined ? [newKey, title] : [newKey];
      });
      const fixedMission = { ...parsed, instructions: fixed };
      setCodeEditorValue(JSON.stringify(fixedMission, null, 2));
      setCodeEditorError(null);
    } catch {
      setCodeEditorError("Invalid JSON — fix syntax errors before running the deduplication");
    }
  };

  /**
   * Walk selectedInstructions using a positional stack to match IF↔END-IF pairs,
   * then find each pair's direct ELSE (at depth+1, not inside a nested IF).
   * Any trio where the three suffixes disagree gets a fresh consistent suffix.
   * Operates on form state directly — the code editor syncs automatically.
   * Purely local; user must click "Save to Database" to persist.
   */
  const handleMigrateIfSuffixes = () => {
    const result: Array<[string, string?]> = selectedInstructions.map(([id, title]) =>
      title !== undefined ? [id, title] : [id],
    );

    // Step 1: compute depth at each index so we can find DIRECT else entries
    // (at depth = ifDepth+1, not inside any nested if block inside the pair).
    const depthAtIndex: number[] = new Array(result.length).fill(0);
    let depth = 0;
    for (let i = 0; i < result.length; i++) {
      const [id] = result[i];
      if (id.startsWith("if-")) {
        depthAtIndex[i] = depth;
        depth++;
      } else if (id.startsWith("end-if-")) {
        depth--;
        depthAtIndex[i] = depth;
      } else {
        depthAtIndex[i] = depth;
      }
    }

    // Step 2: build IF↔END-IF pairs positionally (stack, not suffix)
    const stack: Array<{ ifIndex: number }> = [];
    const pairs: Array<{ ifIndex: number; endIfIndex: number; elseIndex: number | null }> = [];
    for (let i = 0; i < result.length; i++) {
      const [id] = result[i];
      if (id.startsWith("if-")) {
        stack.push({ ifIndex: i });
      } else if (id.startsWith("end-if-")) {
        const top = stack.pop();
        if (top) {
          // Find the direct ELSE: an else- row at exactly (ifDepth+1) that sits
          // between this IF and END-IF and is not inside a nested block.
          const ifDepth = depthAtIndex[top.ifIndex];
          let elseIndex: number | null = null;
          for (let j = top.ifIndex + 1; j < i; j++) {
            const [eid] = result[j];
            if (eid.startsWith("else-") && depthAtIndex[j] === ifDepth + 1) {
              elseIndex = j;
              break;
            }
          }
          pairs.push({ ifIndex: top.ifIndex, endIfIndex: i, elseIndex });
        }
      }
    }

    // Step 3: fix any pair whose IF / ELSE / END-IF suffixes don't all agree
    let changed = 0;
    for (const pair of pairs) {
      const ifId = result[pair.ifIndex][0];
      const endIfId = result[pair.endIfIndex][0];
      const ifSuffix = ifId.slice("if-".length);
      const endIfSuffix = endIfId.slice("end-if-".length);
      const elseId = pair.elseIndex !== null ? result[pair.elseIndex][0] : null;
      const elseSuffix = elseId ? elseId.slice("else-".length) : null;

      const isConsistent =
        ifSuffix === endIfSuffix && (elseSuffix === null || elseSuffix === ifSuffix);

      if (!isConsistent) {
        changed++;
        // Use a unique suffix; append the counter so rapid calls don't collide
        const newSuffix = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-m${changed}`;
        const [, ifTitle] = result[pair.ifIndex];
        const [, endIfTitle] = result[pair.endIfIndex];
        result[pair.ifIndex] = ifTitle !== undefined ? [`if-${newSuffix}`, ifTitle] : [`if-${newSuffix}`];
        result[pair.endIfIndex] =
          endIfTitle !== undefined ? [`end-if-${newSuffix}`, endIfTitle] : [`end-if-${newSuffix}`];
        if (pair.elseIndex !== null) {
          const [, elseTitle] = result[pair.elseIndex];
          result[pair.elseIndex] =
            elseTitle !== undefined ? [`else-${newSuffix}`, elseTitle] : [`else-${newSuffix}`];
        }
      }
    }

    if (changed === 0) {
      alert("All IF/ELSE/END-IF blocks already have consistent suffixes. No migration needed.");
      return;
    }

    setSelectedInstructions(result);
    alert(
      `Migrated ${changed} IF block${changed === 1 ? "" : "s"} to consistent suffixes. ` +
        `Click "Save to Database" to persist the changes.`,
    );
  };

  useEffect(() => {
    if (missionFetcher.data && missionFetcher.state === "idle") {
      if (missionFetcher.data.success && missionFetcher.data.newMissionId) {
        window.location.href = `/admin/missions?lang=${language}&missionId=${missionFetcher.data.newMissionId}`;
      } else if (missionFetcher.data.error) {
        alert(`Failed to create mission: ${missionFetcher.data.error}`);
      }
    }
  }, [missionFetcher.data, missionFetcher.state, language]);

  useEffect(() => {
    if (deleteMissionFetcher.data && deleteMissionFetcher.state === "idle") {
      if (deleteMissionFetcher.data.success) {
        alert(deleteMissionFetcher.data.message || "Mission deleted successfully!");
        window.location.href = `/admin/missions?lang=${language}`;
      } else if (deleteMissionFetcher.data.error) {
        alert(`Failed to delete mission: ${deleteMissionFetcher.data.error}`);
      }
    }
  }, [deleteMissionFetcher.data, deleteMissionFetcher.state, language]);

  useEffect(() => {
    if (duplicateMissionFetcher.data && duplicateMissionFetcher.state === "idle") {
      if (duplicateMissionFetcher.data.success && duplicateMissionFetcher.data.newMissionId) {
        window.location.href = `/admin/missions?lang=${language}&missionId=${duplicateMissionFetcher.data.newMissionId}`;
      } else if (duplicateMissionFetcher.data.error) {
        alert(`Failed to duplicate mission: ${duplicateMissionFetcher.data.error}`);
      }
    }
  }, [duplicateMissionFetcher.data, duplicateMissionFetcher.state, language]);

  useEffect(() => {
    if (testModeFetcher.data && testModeFetcher.state === "idle") {
      const result = testModeFetcher.data;
      if (result.success) {
        if (result.tempMissionId) {
          // startTestMode succeeded — load the temp mission
          window.location.href = `/admin/missions?lang=${language}&missionId=${result.tempMissionId}`;
        } else if (result.sourceMissionId) {
          // publishTestMode / discardTestMode succeeded — go back to the original
          window.location.href = `/admin/missions?lang=${language}&missionId=${result.sourceMissionId}`;
        }
      } else if (result.error) {
        alert(`Test mode error: ${result.error}`);
      }
    }
  }, [testModeFetcher.data, testModeFetcher.state, language]);

  useEffect(() => {
    if (importBundleFetcher.data && importBundleFetcher.state === "idle") {
      if (importBundleFetcher.data.success) {
        const missionId = importBundleFetcher.data.importedMissionId;
        alert(importBundleFetcher.data.message || "Import successful!");
        window.location.href = `/admin/missions?lang=${language}${missionId ? `&missionId=${missionId}` : ""}`;
      } else if (importBundleFetcher.data.error) {
        alert(`Import failed: ${importBundleFetcher.data.error}`);
      }
    }
  }, [importBundleFetcher.data, importBundleFetcher.state, language]);

  useEffect(() => {
    if (drawioImportFetcher.data && drawioImportFetcher.state === "idle") {
      if (drawioImportFetcher.data.success && drawioImportFetcher.data.newMissionId) {
        window.location.href = `/admin/missions?lang=${language}&missionId=${drawioImportFetcher.data.newMissionId}`;
      } else if (drawioImportFetcher.data.error) {
        alert(`Failed to create mission from draw.io: ${drawioImportFetcher.data.error}`);
      }
    }
  }, [drawioImportFetcher.data, drawioImportFetcher.state, language]);

  useEffect(() => {
    if (createAndEditFetcher.data && createAndEditFetcher.state === "idle" && pendingTempEdit) {
      const result = createAndEditFetcher.data;
      if (result.success && result.newInstructionId) {
        const newId = result.newInstructionId;
        const { tempId, title: tempTitle } = pendingTempEdit;
        setPendingTempTitle(tempTitle);
        // Replace the temp ID in the mission's instruction list with the real new ID
        const updatedInstructions = selectedInstructions.map(([id, title]) =>
          id === tempId ? ([newId, title] as [string, string?]) : ([id, title] as [string, string?]),
        );
        setSelectedInstructions(updatedInstructions);
        setPendingTempEdit(null);
        setPendingNavigateToInstructionId(newId);

        if (selectedMissionId && session) {
          // Save the mission with the updated instruction list (temp ID → real ID) before navigating
          const updatedMission = {
            id,
            title,
            description,
            instructions: updatedInstructions,
            status,
          };
          if (selectedMissionId) {
            localStorage.setItem("lastSelectedMissionId", selectedMissionId);
          }
          const formData = new FormData();
          formData.append("actionType", "saveMission");
          formData.append("id", id);
          formData.append("dataEn", JSON.stringify(updatedMission));
          formData.append("language", language);
          formData.append("isExample", String(isExample));
          formData.append("accessToken", session.access_token || "");
          saveMissionAfterCreateFetcher.submit(formData, { method: "post" });
        } else {
          // No mission to save — navigate immediately
          window.location.href = `/admin/instructions?lang=${language}&instructionId=${newId}${tempTitle ? `&title=${encodeURIComponent(tempTitle)}` : ""}`;
        }
      } else if (result.error) {
        alert(`Failed to create instruction: ${result.error}`);
        setPendingTempEdit(null);
      }
    }
  }, [
    createAndEditFetcher.data,
    createAndEditFetcher.state,
    pendingTempEdit,
    selectedInstructions,
    selectedMissionId,
    language,
  ]);

  useEffect(() => {
    if (
      saveMissionAfterCreateFetcher.data &&
      saveMissionAfterCreateFetcher.state === "idle" &&
      pendingNavigateToInstructionId
    ) {
      const result = saveMissionAfterCreateFetcher.data;
      if (result.success) {
        const instructionId = pendingNavigateToInstructionId;
        setPendingNavigateToInstructionId(null);
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${instructionId}${pendingTempTitle ? `&title=${encodeURIComponent(pendingTempTitle)}` : ""}`;
      } else if (result.error) {
        alert(`Warning: Instruction created but mission save failed: ${result.error}`);
        const instructionId = pendingNavigateToInstructionId;
        setPendingNavigateToInstructionId(null);
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${instructionId}${pendingTempTitle ? `&title=${encodeURIComponent(pendingTempTitle)}` : ""}`;
      }
    }
  }, [
    saveMissionAfterCreateFetcher.data,
    saveMissionAfterCreateFetcher.state,
    pendingNavigateToInstructionId,
    pendingTempTitle,
    language,
  ]);

  const handleAddNote = () => {
    const trimmed = newNoteText.trim();
    if (!trimmed || !selectedMissionId) return;
    const updatedNotes = [...adminNotes, trimmed];
    setAdminNotes(updatedNotes);
    setNewNoteText("");
    setShowNoteInput(false);
    saveMissionAdminNotes(updatedNotes);
  };

  const handleRemoveNote = (index: number) => {
    const updatedNotes = adminNotes.filter((_, i) => i !== index);
    setAdminNotes(updatedNotes);
    saveMissionAdminNotes(updatedNotes);
  };

  const handleStartEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setEditingNoteText(adminNotes[index]);
  };

  const handleSaveEditedNote = () => {
    if (editingNoteIndex === null) return;
    const trimmed = editingNoteText.trim();
    if (!trimmed) return;
    const updatedNotes = adminNotes.map((n, i) => (i === editingNoteIndex ? trimmed : n));
    setAdminNotes(updatedNotes);
    setEditingNoteIndex(null);
    setEditingNoteText("");
    saveMissionAdminNotes(updatedNotes);
  };

  const handleCancelEditNote = () => {
    setEditingNoteIndex(null);
    setEditingNoteText("");
  };

  const saveMissionAdminNotes = (notes: string[]) => {
    if (!selectedMissionId || !session) return;
    const formData = new FormData();
    formData.append("actionType", "saveMissionAdminNote");
    formData.append("missionId", selectedMissionId);
    formData.append("notes", JSON.stringify(notes));
    formData.append("accessToken", session.access_token || "");
    adminNotesFetcher.submit(formData, { method: "post" });
  };

  // Derived: detect whether the currently selected mission instruction is a "link" type
  const selectedBaseIdForLink = selectedMissionInstruction?.includes("#")
    ? selectedMissionInstruction.split("#")[0]
    : selectedMissionInstruction;
  const allInstructionsForLang = language === "he" ? instructionsHe : instructionsEn;
  const selectedInstructionObj = selectedBaseIdForLink
    ? allInstructionsForLang.find((i) => i.id === selectedBaseIdForLink)
    : null;
  const isSelectedLinkType = selectedInstructionObj?.type === "link" && !!selectedInstructionObj?.missionId;
  const selectedLinkMissionId = isSelectedLinkType ? selectedInstructionObj?.missionId : undefined;

  // Derived: missions that the currently selected mission links TO (via link-type instructions)
  const linkedOutMissionIds = Array.from(
    new Set(
      selectedInstructions.flatMap(([instrId]) => {
        const baseId = instrId.includes("#") ? instrId.split("#")[0] : instrId;
        const instr = instructionsEn.find((i) => i.id === baseId);
        if (instr?.type === "link" && instr.missionId) return [instr.missionId];
        return [];
      }),
    ),
  );

  const handleEditInstruction = (instructionId: string) => {
    const isTemp = /^T\d+$/.test(instructionId);
    // Strip the duplicate suffix (#2, #3, …) to get the real instruction ID
    const baseId = instructionId.includes("#") ? instructionId.split("#")[0] : instructionId;

    if (!isTemp) {
      // Existing instruction — navigate directly
      if (selectedMissionId) {
        localStorage.setItem("lastSelectedMissionId", selectedMissionId);
      }
      onNavigationRequest(() => {
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${baseId}`;
      });
      return;
    }

    // Temp instruction — create a real one first
    const entryData = selectedInstructions.find(([id]) => id === instructionId);
    const tempTitle = entryData?.[1] || "";

    const numericIds = allInstructionIds.map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const newInstructionId = String(maxId + 1);

    setPendingTempEdit({ tempId: instructionId, title: tempTitle });

    const formData = new FormData();
    formData.append("actionType", "createInstruction");
    formData.append("newId", newInstructionId);
    formData.append("language", language);
    formData.append("accessToken", session?.access_token || "");
    createAndEditFetcher.submit(formData, { method: "post" });
  };

  const handleClearForNewMission = () => {
    onNavigationRequest(() => {
      if (selectedMissionId) {
        localStorage.setItem("lastSelectedMissionId", selectedMissionId);
      }
      const formData = new FormData();
      formData.append("actionType", "createMission");
      formData.append("accessToken", session?.access_token || "");

      missionFetcher.submit(formData, { method: "post" });
    });
  };

  const handleSelectLastMission = () => {
    const lastMissionId = localStorage.getItem("lastSelectedMissionId");
    if (lastMissionId && allMissionIds.includes(lastMissionId)) {
      onNavigationRequest(() => {
        updateMissionFormFields(lastMissionId);
        localStorage.setItem("scrollToInstructions", "true");
        window.location.href = `/admin/missions?lang=${language}&missionId=${lastMissionId}`;
      });
    } else {
      alert("No previous mission found or the mission no longer exists");
    }
  };

  const handleDeleteMission = () => {
    if (!selectedMissionId) {
      alert("Please select a mission first");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete mission "${id} - ${title}"?\n\nThis action cannot be undone and will remove the mission from the database.`,
    );

    if (!confirmDelete) {
      return;
    }

    const formData = new FormData();
    formData.append("actionType", "deleteMission");
    formData.append("missionId", selectedMissionId);
    formData.append("accessToken", session?.access_token || "");

    deleteMissionFetcher.submit(formData, { method: "post" });
  };

  const hasUnsavedChangesMission = selectedMissionId && originalCode !== "" && generateCode() !== originalCode;

  const handleTranslateAndSwitch = async () => {
    if (!title || !description) {
      alert("Please fill in the title and description before translating");
      return;
    }

    setIsTranslating(true);

    try {
      const sourceLang = language === "en" ? "en" : "he";
      const targetLang = language === "en" ? "he" : "en";

      const titleFormData = new FormData();
      titleFormData.append("actionType", "translate");
      titleFormData.append("text", title);
      titleFormData.append("sourceLang", sourceLang);
      titleFormData.append("targetLang", targetLang);

      const titleResponse = await fetch("/admin", {
        method: "POST",
        body: titleFormData,
      });
      const titleResult = await titleResponse.json();

      if (!titleResult.success) {
        throw new Error(titleResult.error || "Title translation failed");
      }

      const descFormData = new FormData();
      descFormData.append("actionType", "translate");
      descFormData.append("text", description);
      descFormData.append("sourceLang", sourceLang);
      descFormData.append("targetLang", targetLang);

      const descResponse = await fetch("/admin", {
        method: "POST",
        body: descFormData,
      });
      const descResult = await descResponse.json();

      if (!descResult.success) {
        throw new Error(descResult.error || "Description translation failed");
      }

      setTitle(titleResult.translatedText);
      setDescription(descResult.translatedText);

      alert(`Translation successful! Fields updated to ${targetLang === "he" ? "Hebrew" : "English"}`);

      window.location.href = `/admin/missions?lang=${targetLang}`;
    } catch (error) {
      console.error("Translation error:", error);
      alert(`Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const hasUnsavedChanges = selectedMissionId && originalCode !== "" && generateCode() !== originalCode;

  const handleOpenJsonDialog = () => {
    if (!selectedMissionInstruction) {
      alert("Please select an instruction from the list using the radio button first");
      return;
    }
    const isComment = selectedMissionInstruction.startsWith("comment-") || selectedMissionInstruction === "0";
    const isIf = selectedMissionInstruction.startsWith("if-");
    const isEndIf = selectedMissionInstruction.startsWith("end-if-");
    const isElse = selectedMissionInstruction.startsWith("else-");
    const isTemp = /^T\d+$/.test(selectedMissionInstruction);
    if (isComment || isIf || isEndIf || isElse || isTemp) {
      alert("JSON editing is only available for real saved instructions");
      return;
    }
    // Strip the duplicate suffix (#2, #3, …) to get the real instruction ID
    const baseId = selectedMissionInstruction.includes("#")
      ? selectedMissionInstruction.split("#")[0]
      : selectedMissionInstruction;
    const allInstructions = language === "he" ? instructionsHe : instructionsEn;
    const instruction = allInstructions.find((i) => i.id === baseId);
    const jsonValue = instruction ? JSON.stringify(instruction, null, 2) : `{ "id": "${baseId}" }`;
    setJsonDialogInstructionId(baseId);
    setJsonEditorValue(jsonValue);
    setJsonSaveError(null);
    setShowJsonDialog(true);
  };

  const handleSaveJson = () => {
    if (!jsonDialogInstructionId || !session) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonEditorValue);
    } catch {
      setJsonSaveError("Invalid JSON — please fix syntax errors before saving");
      return;
    }
    setJsonSaveError(null);
    const formData = new FormData();
    formData.append("actionType", "saveInstruction");
    formData.append("id", jsonDialogInstructionId);
    formData.append("dataEn", JSON.stringify(parsed));
    formData.append("language", language);
    formData.append("accessToken", session.access_token || "");
    jsonFetcher.submit(formData, { method: "post" });
  };

  const isJsonSaving = jsonFetcher.state !== "idle";

  const handleDrawioImport = (importedInstructions: Array<[string, string?]>) => {
    const doCreate = () => {
      const formData = new FormData();
      formData.append("actionType", "createMissionWithInstructions");
      formData.append("instructions", JSON.stringify(importedInstructions));
      formData.append("accessToken", session?.access_token || "");
      drawioImportFetcher.submit(formData, { method: "post" });
    };

    // If there are unsaved changes, prompt the user to save/discard first
    if (hasUnsavedChangesMission) {
      onNavigationRequest(doCreate);
    } else {
      doCreate();
    }
  };

  /**
   * Export — bundles the selected mission + all its real instructions (EN & HE)
   * into a JSON file and triggers the browser's Save dialog.
   */
  const handleExportMission = async () => {
    if (!selectedMissionId) {
      alert("Please select a mission first");
      return;
    }

    // Collect real instruction IDs (strip #N suffixes, skip specials)
    const realIds = Array.from(
      new Set(
        selectedInstructions
          .map(([instrId]) => instrId)
          .filter(
            (instrId) =>
              !instrId.startsWith("comment-") &&
              !instrId.startsWith("if-") &&
              !instrId.startsWith("end-if-") &&
              !instrId.startsWith("else-") &&
              !/^T\d+$/.test(instrId) &&
              instrId !== "0",
          )
          .map((instrId) => (instrId.includes("#") ? instrId.split("#")[0] : instrId)),
      ),
    );

    const missionData = {
      id,
      title,
      description,
      instructions: selectedInstructions,
      status,
      isExample,
    };

    // Include the Hebrew version of the mission from the DB (data_he column).
    // Always include missionHe in the bundle — fall back to English values when
    // no Hebrew record has been saved yet so the import side always has a node.
    const heVersionOfMission = allMissionsHe.find((m) => m.id === selectedMissionId);
    const missionHeData = {
      id: heVersionOfMission?.id ?? id,
      title: heVersionOfMission?.title ?? title,
      description: heVersionOfMission?.description ?? description,
      instructions: heVersionOfMission?.instructions ?? selectedInstructions,
      status: heVersionOfMission?.status ?? status,
    };

    const enInstructions = instructionsEn.filter((i) => realIds.includes(i.id));
    const heInstructions = instructionsHe.filter((i) => realIds.includes(i.id));

    const bundle: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      mission: missionData,
      missionHe: missionHeData,
      instructionsEn: enInstructions,
      instructionsHe: heInstructions,
    };

    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const fileName = `mission-${id}-${new Date().toISOString().slice(0, 10)}.json`;

    // Try File System Access API (Chromium) for a real "Save As" dialog
    if ("showSaveFilePicker" in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "JSON file", accept: { "application/json": [".json"] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: unknown) {
        // User cancelled or API failed — fall through to classic download
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    // Classic fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Import — opens a file picker, reads the JSON bundle, and submits it to
   * the server to upsert the mission and all its instructions by their IDs.
   */
  const handleImportMission = () => {
    if (!session) {
      alert("You must be logged in to import");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        // Validate it's parseable JSON before sending
        JSON.parse(text);

        const confirm = window.confirm(
          `Import bundle from "${file.name}"?\n\nThis will OVERWRITE the mission and all its instructions in the database using the IDs from the file. Continue?`,
        );
        if (!confirm) return;

        const formData = new FormData();
        formData.append("actionType", "importMissionBundle");
        formData.append("bundle", text);
        formData.append("accessToken", session.access_token || "");
        importBundleFetcher.submit(formData, { method: "post" });
      } catch {
        alert("Failed to read file — make sure it is a valid JSON export bundle");
      }
    };
    input.click();
  };

  // ─── Test Mode Handlers ───────────────────────────────────────────────────

  // Derived: is the currently selected mission a temporary test copy?
  const currentMissionMeta = missions.find((m) => m.id === selectedMissionId);
  const isCurrentMissionTemp = currentMissionMeta?.isTemp === true;
  const tempSourceMissionId = currentMissionMeta?.sourceMissionId ?? null;

  // Is there already a temp version for the currently selected (non-temp) mission?
  const existingTempForCurrent = missions.find(
    (m) => m.isTemp && m.sourceMissionId === selectedMissionId,
  );

  const handleStartTestMode = () => {
    if (!selectedMissionId) {
      alert("Please select a mission first");
      return;
    }
    if (!session) {
      alert("You must be logged in");
      return;
    }
    if (isCurrentMissionTemp) {
      alert("You are already editing a test copy. Click \"Publish\" to apply or \"Discard\" to cancel.");
      return;
    }
    if (existingTempForCurrent) {
      const load = window.confirm(
        `A test session already exists for this mission (temp ID: ${existingTempForCurrent.id}).\n\nClick OK to load it, or Cancel to stay here.`,
      );
      if (load) {
        handleSelectMission(existingTempForCurrent.id);
      }
      return;
    }
    const confirmed = window.confirm(
      `Start Test Mode for mission "${id} - ${title}"?\n\nThis will create a temporary copy of the mission and all its instructions. You can freely edit it and then publish your changes — or discard them without affecting the original.`,
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.append("actionType", "startTestMode");
    formData.append("sourceMissionId", selectedMissionId);
    formData.append("accessToken", session.access_token || "");
    testModeFetcher.submit(formData, { method: "post" });
  };

  const handlePublishTestMode = () => {
    if (!selectedMissionId || !isCurrentMissionTemp || !session) return;
    const confirmed = window.confirm(
      `Publish changes?\n\nThis will overwrite mission ${tempSourceMissionId} and all its instructions with the edited test copies, then delete the temporary records.\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.append("actionType", "publishTestMode");
    formData.append("tempMissionId", selectedMissionId);
    formData.append("accessToken", session.access_token || "");
    testModeFetcher.submit(formData, { method: "post" });
  };

  const handleDiscardTestMode = () => {
    if (!selectedMissionId || !isCurrentMissionTemp || !session) return;
    const confirmed = window.confirm(
      "Discard test session?\n\nAll edits to the temporary copies will be lost and the original mission will remain unchanged.",
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.append("actionType", "discardTestMode");
    formData.append("tempMissionId", selectedMissionId);
    formData.append("accessToken", session.access_token || "");
    testModeFetcher.submit(formData, { method: "post" });
  };

  const handleDuplicateMission = () => {
    if (!selectedMissionId) {
      alert("Please select a mission first");
      return;
    }
    const confirmDuplicate = window.confirm(
      `Duplicate mission "${id} - ${title}"?\n\nA new mission will be created with the same data and a new ID.`,
    );
    if (!confirmDuplicate) return;

    const formData = new FormData();
    formData.append("actionType", "duplicateMission");
    formData.append("sourceMissionId", selectedMissionId);
    formData.append("accessToken", session?.access_token || "");
    duplicateMissionFetcher.submit(formData, { method: "post" });
  };

  // Sorted and filtered mission IDs for the selection dropdown.
  // Temp missions always appear at the bottom of the list.
  const tempMissionIdSet = new Set(missions.filter((m) => m.isTemp).map((m) => m.id));
  const sortedMissionIds = [...allMissionIds].sort((a, b) => {
    const aIsTemp = tempMissionIdSet.has(a);
    const bIsTemp = tempMissionIdSet.has(b);
    if (aIsTemp && !bIsTemp) return 1;
    if (!aIsTemp && bIsTemp) return -1;
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Build a lookup map from org ID → org name for the filter dropdown
  const orgNameMap = new Map(organizations.map((o) => [o.id, o.name]));

  const allOrgIds = Array.from(new Set(missionsWithAccess.flatMap((m) => m.allowedOrgIds))).sort();

  const nameLower = filterMissionName.trim().toLowerCase();
  const descLower = filterMissionDesc.trim().toLowerCase();
  const filteredMissionIds = sortedMissionIds.filter((missionId) => {
    // Always show temp missions regardless of filters (they're special)
    if (tempMissionIdSet.has(missionId)) return true;
    if (nameLower) {
      const mission = missions.find((m) => m.id === missionId);
      if (!(mission?.title || "").toLowerCase().includes(nameLower)) return false;
    }
    if (descLower) {
      const mission = missions.find((m) => m.id === missionId);
      if (!(mission?.description || "").toLowerCase().includes(descLower)) return false;
    }
    if (filterMissionOrg) {
      const accessInfo = missionsWithAccess.find((m) => m.id === missionId);
      if (!accessInfo?.allowedOrgIds.includes(filterMissionOrg)) return false;
    }
    return true;
  });

  return (
    <div className={styles.div4}>
      <div className={styles.formSection}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-3)",
          }}
        >
          <h2
            className={styles.sectionTitle}
            style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)" }}
          >
            Select Mission to Edit
          </h2>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={handleDeleteMission}
              className={styles.removeButton}
              disabled={!selectedMissionId || deleteMissionFetcher.state !== "idle" || !session}
              data-explanation-id="admin-mission-delete"
            >
              {deleteMissionFetcher.state !== "idle" ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={handleDuplicateMission}
              className={styles.addButton}
              disabled={!selectedMissionId || duplicateMissionFetcher.state !== "idle" || !session}
              title="Create a copy of the selected mission with a new ID"
              data-explanation-id="admin-mission-duplicate"
            >
              {duplicateMissionFetcher.state !== "idle" ? "Duplicating..." : "Duplicate Mission"}
            </button>
            {/* ─── Test Mode buttons ─── */}
            {isCurrentMissionTemp ? (
              <>
                <button
                  type="button"
                  onClick={handlePublishTestMode}
                  disabled={testModeFetcher.state !== "idle" || !session}
                  title="Overwrite the original mission and instructions with the edited test copies, then delete the temporary records"
                  style={{
                    padding: "var(--space-1) var(--space-3)",
                    borderRadius: "var(--radius-2)",
                    border: "2px solid red",
                    background: "transparent",
                    color: "red",
                    fontWeight: 700,
                    cursor: testModeFetcher.state !== "idle" || !session ? "not-allowed" : "pointer",
                    opacity: testModeFetcher.state !== "idle" || !session ? 0.5 : 1,
                    fontSize: "0.85rem",
                  }}
                >
                  {testModeFetcher.state !== "idle" ? "Publishing..." : "🚀 Publish"}
                </button>
                <button
                  type="button"
                  onClick={handleDiscardTestMode}
                  className={styles.removeButton}
                  disabled={testModeFetcher.state !== "idle" || !session}
                  title="Discard the test session without affecting the original mission"
                >
                  {testModeFetcher.state !== "idle" ? "Discarding..." : "✕ Discard Test"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartTestMode}
                className={styles.addButton}
                disabled={!selectedMissionId || testModeFetcher.state !== "idle" || !session || !!existingTempForCurrent}
                title={
                  existingTempForCurrent
                    ? `A test session already exists (ID: ${existingTempForCurrent.id}) — click the button with the session loaded`
                    : "Create a temporary copy of this mission and its instructions to safely test edits before publishing"
                }
                data-explanation-id="admin-mission-test-mode"
              >
                {testModeFetcher.state !== "idle" ? "Starting..." : existingTempForCurrent ? "🧪 Test Active" : "🧪 Test Mode"}
              </button>
            )}
            <button
              type="button"
              onClick={handleClearForNewMission}
              className={styles.addButton}
              disabled={missionFetcher.state !== "idle" || !session}
              data-explanation-id="admin-mission-create-new"
            >
              {missionFetcher.state !== "idle" ? "Creating..." : "+ Create New Mission"}
            </button>
            <button
              type="button"
              onClick={() => setShowDrawioDialog(true)}
              className={styles.addButton}
              disabled={drawioImportFetcher.state !== "idle" || !session}
              title="Import a draw.io flowchart and create a new mission from it"
              style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
              data-explanation-id="admin-mission-drawio"
            >
              {drawioImportFetcher.state !== "idle" ? "Creating..." : "📊 draw.io"}
            </button>
            <button
              type="button"
              onClick={handleExportMission}
              className={styles.addButton}
              disabled={!selectedMissionId}
              title="Export this mission and all its instructions to a JSON file"
              style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
              data-explanation-id="admin-mission-export"
            >
              ⬇ Export
            </button>
            <button
              type="button"
              onClick={handleImportMission}
              className={styles.addButton}
              disabled={importBundleFetcher.state !== "idle" || !session}
              title="Import a previously exported mission bundle JSON file — overwrites existing records by ID"
              style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
              data-explanation-id="admin-mission-import"
            >
              {importBundleFetcher.state !== "idle" ? "Importing..." : "⬆ Import"}
            </button>
          </div>
        </div>

        {/* ─── Test Mode Banner ─── */}
        {isCurrentMissionTemp && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              background: "var(--amber-3)",
              border: "1px solid var(--amber-7)",
              borderRadius: "var(--radius-2)",
              padding: "var(--space-2) var(--space-4)",
              marginBottom: "var(--space-3)",
              fontSize: "0.85rem",
              color: "var(--amber-12)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>🧪</span>
            <span>
              <strong>TEST MODE</strong> — You are editing a temporary copy of mission{" "}
              <strong>{tempSourceMissionId}</strong>. Changes here do{" "}
              <em>not</em> affect the original until you click{" "}
              <strong style={{ color: "red" }}>Publish</strong>.
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)", marginLeft: "auto", flexShrink: 0 }}>
              <button
                type="button"
                onClick={handlePublishTestMode}
                disabled={testModeFetcher.state !== "idle" || !session}
                style={{
                  padding: "2px 12px",
                  border: "2px solid red",
                  borderRadius: "var(--radius-2)",
                  background: "transparent",
                  color: "red",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.82rem",
                }}
              >
                🚀 Publish
              </button>
              <button
                type="button"
                onClick={handleDiscardTestMode}
                disabled={testModeFetcher.state !== "idle" || !session}
                style={{
                  padding: "2px 10px",
                  border: "1px solid var(--amber-8)",
                  borderRadius: "var(--radius-2)",
                  background: "transparent",
                  color: "var(--amber-12)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                }}
              >
                ✕ Discard
              </button>
            </div>
          </div>
        )}

        {(() => {
          // Build a map: instruction ID → linked mission ID, for all link-type instructions.
          // A "link instruction" is an instruction with type="link" and a missionId field stored
          // inside its data — the instruction has its own normal numeric ID, NOT the mission ID.
          const linkInstructionMap = new Map<string, string>();
          for (const instr of instructionsEn) {
            if (instr.type === "link" && instr.missionId) {
              linkInstructionMap.set(instr.id, instr.missionId);
            }
          }

          // Build:
          // 1. linkedMissionIds — set of missions that are targeted by a link instruction
          // 2. reverseLinkedMap — targetMissionId → [sourceMissionIds that link to it]
          const linkedMissionIds = new Set<string>();
          const reverseLinkedMap = new Map<string, string[]>();
          for (const m of missionsWithAccess) {
            if (Array.isArray(m.instructions)) {
              for (const [instrId] of m.instructions) {
                const baseId = instrId.includes("#") ? instrId.split("#")[0] : instrId;
                const linkedMissionId = linkInstructionMap.get(baseId);
                if (linkedMissionId && allMissionIds.includes(linkedMissionId) && linkedMissionId !== m.id) {
                  linkedMissionIds.add(linkedMissionId);
                  const sources = reverseLinkedMap.get(linkedMissionId) ?? [];
                  if (!sources.includes(m.id)) sources.push(m.id);
                  reverseLinkedMap.set(linkedMissionId, sources);
                }
              }
            }
          }

          const orgAssignedIds = new Set<string>(
            missionsWithAccess.filter((m) => m.allowedOrgIds.length > 0).map((m) => m.id),
          );

          // Linker missions for the currently selected mission (shown in the info banner)
          const selectedLinkers = selectedMissionId ? (reverseLinkedMap.get(selectedMissionId) ?? []) : [];
          const selectedMission = missions.find((m) => m.id === selectedMissionId);
          const isSelectedLinked =
            selectedLinkers.length > 0 && selectedMission?.status !== "Hide" && !orgAssignedIds.has(selectedMissionId);

          return (
            <>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-2)",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  className={styles.input}
                  value={filterMissionName}
                  onChange={(e) => setFilterMissionName(e.target.value)}
                  placeholder="Filter by name..."
                  style={{ flex: 1, minWidth: "140px" }}
                />
                <input
                  type="text"
                  className={styles.input}
                  value={filterMissionDesc}
                  onChange={(e) => setFilterMissionDesc(e.target.value)}
                  placeholder="Filter by description..."
                  style={{ flex: 1, minWidth: "140px" }}
                />
                <select
                  className={styles.input}
                  value={filterMissionOrg}
                  onChange={(e) => setFilterMissionOrg(e.target.value)}
                  style={{ flex: "0 1 auto", minWidth: "170px" }}
                >
                  <option value="">All organizations</option>
                  {allOrgIds.map((orgId) => (
                    <option key={orgId} value={orgId}>
                      {orgNameMap.get(orgId) ?? orgId}
                    </option>
                  ))}
                </select>
                {(filterMissionName || filterMissionDesc || filterMissionOrg) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMissionName("");
                      setFilterMissionDesc("");
                      setFilterMissionOrg("");
                    }}
                    className={styles.addButton}
                    style={{ flexShrink: 0, marginRight: 0 }}
                    data-explanation-id="admin-mission-filter-clear"
                  >
                    ✕ Clear
                  </button>
                )}
                <span
                  style={{ fontSize: "0.8rem", color: "var(--color-neutral-10)", flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  {filteredMissionIds.length} / {allMissionIds.length}
                </span>
                <button
                  type="button"
                  onClick={handleSelectLastMission}
                  className={styles.addButton}
                  disabled={!localStorage.getItem("lastSelectedMissionId")}
                  data-explanation-id="admin-mission-select-last"
                >
                  Select Last Mission
                </button>
              </div>
              <select
                className={styles.input}
                value={selectedMissionId}
                onChange={(e) => handleSelectMission(e.target.value)}
              >
                <option value="">Select a mission...</option>
                {filteredMissionIds.map((missionId) => {
                  const mission = missions.find((m) => m.id === missionId);
                  const isTemp = mission?.isTemp === true;
                  const isHidden = !isTemp && mission?.status === "Hide";
                  const isOrgAssigned = !isTemp && !isHidden && orgAssignedIds.has(missionId);
                  const isLinked = !isTemp && !isHidden && !isOrgAssigned && linkedMissionIds.has(missionId);
                  const prefix = isTemp ? "🧪 " : isHidden ? "🔴 " : isOrgAssigned ? "🟢 " : isLinked ? "🟡 " : "";
                  const linkers = reverseLinkedMap.get(missionId) ?? [];
                  const optionTitle = isTemp
                    ? `TEST COPY of mission ${mission?.sourceMissionId} — not visible to users`
                    : isLinked && linkers.length > 0
                      ? `Linked from: ${linkers
                          .map((id) => {
                            const m = missions.find((m) => m.id === id);
                            return m ? `${id} - ${m.title}` : id;
                          })
                          .join(" | ")}`
                      : undefined;
                  return (
                    <option key={missionId} value={missionId} title={optionTitle}>
                      {prefix}
                      {missionId}
                      {mission
                        ? isTemp
                          ? ` - [TEST] ${mission.title} (copy of ${mission.sourceMissionId})`
                          : ` - ${mission.title}`
                        : " (No data for this language)"}
                    </option>
                  );
                })}
              </select>
              {isSelectedLinked && (
                <div
                  style={{
                    marginTop: "var(--space-2)",
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--amber-3)",
                    border: "1px solid var(--amber-7)",
                    borderRadius: "var(--radius-2)",
                    fontSize: "0.8125rem",
                    color: "var(--amber-11)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-2)",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>🟡</span>
                  <span>
                    <strong>Used as a linked mission by:</strong>{" "}
                    {selectedLinkers.map((sourceId, idx) => {
                      const sourceMission = missions.find((m) => m.id === sourceId);
                      return (
                        <span key={sourceId}>
                          {idx > 0 && ", "}
                          <strong
                            style={{ cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => handleSelectMission(sourceId)}
                            title={`Go to mission ${sourceId}`}
                          >
                            {sourceId}
                          </strong>
                          {sourceMission ? ` – ${sourceMission.title}` : ""}
                        </span>
                      );
                    })}
                  </span>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {selectedMissionId && (
        <>
          <div className={styles.formSection}>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <h2
                className={styles.sectionTitle}
                style={{
                  color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Select Instructions
              </h2>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-accent-11)",
                  fontWeight: 500,
                  padding: "var(--space-2)",
                  background: "var(--color-accent-3)",
                  borderRadius: "var(--radius-2)",
                  border: "1px solid var(--color-accent-6)",
                }}
              >
                Current Mission: {id} - {title || "(Untitled)"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }} className={styles.div3}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Available Instructions</h3>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  <input
                    type="text"
                    className={styles.input}
                    value={instructionFilter}
                    onChange={(e) => setInstructionFilter(e.target.value)}
                    placeholder="Filter by title or description..."
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setInstructionFilter("")}
                    className={styles.addButton}
                    disabled={!instructionFilter}
                    style={{ minWidth: "80px" }}
                    data-explanation-id="admin-mission-available-clear"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedAvailableInstructions.length === 1) {
                        handleEditInstruction(selectedAvailableInstructions[0]);
                      }
                    }}
                    className={styles.addButton}
                    disabled={selectedAvailableInstructions.length !== 1 || createAndEditFetcher.state !== "idle"}
                    style={{ minWidth: "60px" }}
                    title={
                      selectedAvailableInstructions.length === 0
                        ? "Select exactly one instruction to edit it"
                        : selectedAvailableInstructions.length === 1
                          ? "Open selected instruction in the Instructions editor"
                          : `Select only 1 instruction (${selectedAvailableInstructions.length} selected)`
                    }
                    data-explanation-id="admin-mission-available-edit"
                  >
                    {selectedAvailableInstructions.length === 0
                      ? "Edit"
                      : selectedAvailableInstructions.length === 1
                        ? "✎ Edit"
                        : `Edit (${selectedAvailableInstructions.length})`}
                  </button>
                </div>
                <div
                  style={{
                    border: "1px solid var(--color-neutral-6)",
                    borderRadius: "var(--radius-2)",
                    padding: "var(--space-2)",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {instructions
                    .filter((instruction) => {
                      if (!instructionFilter.trim()) return true;
                      const searchTerm = instructionFilter.toLowerCase().trim();
                      const title = instruction.title?.toLowerCase() || "";
                      const description = instruction.description?.toLowerCase() || "";
                      return title.includes(searchTerm) || description.includes(searchTerm);
                    })
                    .map((instruction) => {
                      const alreadyAdded = selectedInstructions.some(
                        ([k]) => k === instruction.id || k.startsWith(`${instruction.id}#`),
                      );
                      return (
                        <label
                          key={instruction.id}
                          className={styles.checkboxLabel}
                          style={{
                            padding: "var(--space-2)",
                            borderBottom: "1px solid var(--color-neutral-4)",
                            margin: 0,
                            opacity: alreadyAdded ? 0.6 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAvailableInstructions.includes(instruction.id)}
                            onChange={() => {
                              if (selectedAvailableInstructions.includes(instruction.id)) {
                                setSelectedAvailableInstructions(
                                  selectedAvailableInstructions.filter((id) => id !== instruction.id),
                                );
                              } else {
                                setSelectedAvailableInstructions([...selectedAvailableInstructions, instruction.id]);
                              }
                            }}
                          />
                          <span>
                            <span
                              style={{
                                color:
                                  instruction.status === "full explanation"
                                    ? "green"
                                    : instruction.status === "only title"
                                      ? "red"
                                      : "inherit",
                                fontWeight: 600,
                              }}
                            >
                              {instruction.id}
                            </span>
                            {" - "}
                            {instruction.title}
                            {alreadyAdded && (
                              <span
                                style={{
                                  marginLeft: "var(--space-2)",
                                  fontSize: "0.75rem",
                                  color: "var(--color-accent-10)",
                                }}
                              >
                                (already in mission)
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }} className={styles.div2}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMissionInstruction) {
                      if (selectedMissionInstruction.startsWith("if-")) {
                        // Remove IF, its matching ELSE, and its matching END-IF together.
                        // Suffix is always consistent in the new structure.
                        const suffix = selectedMissionInstruction.replace(/^if-/, "");
                        const elseId = `else-${suffix}`;
                        const endIfId = `end-if-${suffix}`;
                        setSelectedInstructions(
                          selectedInstructions.filter(
                            ([id]) => id !== selectedMissionInstruction && id !== endIfId && id !== elseId,
                          ),
                        );
                      } else {
                        const idx = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
                        if (idx !== -1) {
                          setSelectedInstructions([
                            ...selectedInstructions.slice(0, idx),
                            ...selectedInstructions.slice(idx + 1),
                          ]);
                        }
                      }
                      setSelectedMissionInstruction(null);
                    }
                  }}
                  className={styles.addButton}
                  style={{ width: "80px" }}
                  disabled={!selectedMissionInstruction}
                  data-explanation-id="admin-mission-remove"
                >
                  ← Del
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Generate unique entry keys when the same base ID is added more than once.
                    // Duplicate entries get a "#N" suffix (e.g. "42#2", "42#3") so that each
                    // occurrence has an independent key while the renderer strips the suffix to
                    // resolve the underlying instruction from the database.
                    // We accumulate allocated keys across the batch so that selecting the same
                    // instruction twice in one Add → click also gets distinct suffixes.
                    const allocatedKeys = selectedInstructions.map(([k]) => k);
                    const newEntries: Array<[string, string?]> = selectedAvailableInstructions.map((baseId) => {
                      const alreadyPresent = allocatedKeys.some((k) => k === baseId || k.startsWith(`${baseId}#`));
                      let key: string;
                      if (!alreadyPresent) {
                        key = baseId;
                      } else {
                        let suffix = 2;
                        while (allocatedKeys.includes(`${baseId}#${suffix}`)) suffix++;
                        key = `${baseId}#${suffix}`;
                      }
                      allocatedKeys.push(key);
                      return [key] as [string];
                    });

                    let newInstructions;
                    if (selectedMissionInstruction) {
                      const insertIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
                      newInstructions = [
                        ...selectedInstructions.slice(0, insertIndex + 1),
                        ...newEntries,
                        ...selectedInstructions.slice(insertIndex + 1),
                      ];
                    } else {
                      newInstructions = [...selectedInstructions, ...newEntries];
                    }
                    setSelectedInstructions(newInstructions);
                    setSelectedAvailableInstructions([]);
                  }}
                  className={styles.addButton}
                  style={{ width: "80px" }}
                  disabled={selectedAvailableInstructions.length === 0}
                  data-explanation-id="admin-mission-add"
                >
                  Add →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedMissionInstruction || !selectedAvailableInstructions.length) return;
                    const isTemp = /^T\d+$/.test(selectedMissionInstruction);
                    if (!isTemp) return;
                    const baseReplacementId = selectedAvailableInstructions[0];
                    // Check if this instruction ID is already present elsewhere in the list
                    // (excluding the temp entry being replaced). If so, assign a #N suffix.
                    const otherKeys = selectedInstructions
                      .filter(([id]) => id !== selectedMissionInstruction)
                      .map(([id]) => id);
                    const alreadyPresent = otherKeys.some(
                      (k) => k === baseReplacementId || k.startsWith(`${baseReplacementId}#`),
                    );
                    let replacementId = baseReplacementId;
                    if (alreadyPresent) {
                      let suffix = 2;
                      while (otherKeys.includes(`${baseReplacementId}#${suffix}`)) suffix++;
                      replacementId = `${baseReplacementId}#${suffix}`;
                    }
                    setSelectedInstructions(
                      selectedInstructions.map(([id, title]) =>
                        id === selectedMissionInstruction
                          ? ([replacementId, title] as [string, string?])
                          : ([id, title] as [string, string?]),
                      ),
                    );
                    setSelectedMissionInstruction(replacementId);
                    setSelectedAvailableInstructions([]);
                  }}
                  className={styles.addButton}
                  disabled={
                    !selectedMissionInstruction ||
                    !/^T\d+$/.test(selectedMissionInstruction || "") ||
                    selectedAvailableInstructions.length !== 1
                  }
                  style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                  title="Replace the selected temporary entry's ID with the selected available instruction's ID (keeps local title)"
                  data-explanation-id="admin-mission-link"
                >
                  Link →
                </button>
                <button
                  type="button"
                  onClick={handleAddIf}
                  className={styles.addButton}
                  disabled={!selectedMissionId || !session}
                  title="Insert an IF conditional block after the selected instruction"
                  style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)", marginTop: "var(--space-2)" }}
                  data-explanation-id="admin-mission-add-if"
                >
                  🔀 IF
                </button>
                <button
                  type="button"
                  onClick={handleAddElse}
                  className={styles.addButton}
                  disabled={!selectedMissionId || !session}
                  title="Insert an ELSE branch into the selected IF…END-IF block (select the IF row, a row inside it, or the END-IF row)"
                  style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                  data-explanation-id="admin-mission-add-else"
                >
                  ↔️ ELSE
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommentDialog(true)}
                  className={styles.addButton}
                  disabled={!selectedMissionId || !session}
                  style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                  data-explanation-id="admin-mission-add-comment"
                >
                  💬 Comment
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewInstructionDialog(true)}
                  className={styles.addButton}
                  disabled={!selectedMissionId || !session}
                  style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                  data-explanation-id="admin-mission-add-new-instruction"
                >
                  + New
                </button>
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Mission Instructions</h3>
                  <button
                    type="button"
                    onClick={moveInstructionDown}
                    className={styles.addButton}
                    disabled={
                      !selectedMissionInstruction ||
                      selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction) ===
                        selectedInstructions.length - 1
                    }
                    title="Move selected instruction down"
                    style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    data-explanation-id="admin-mission-move-down"
                  >
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    onClick={moveInstructionUp}
                    className={styles.addButton}
                    disabled={
                      !selectedMissionInstruction ||
                      selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction) === 0
                    }
                    title="Move selected instruction up"
                    style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    data-explanation-id="admin-mission-move-up"
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenJsonDialog}
                    className={styles.addButton}
                    disabled={
                      !selectedMissionInstruction ||
                      selectedMissionInstruction.startsWith("comment-") ||
                      selectedMissionInstruction.startsWith("if-") ||
                      selectedMissionInstruction.startsWith("end-if-") ||
                      selectedMissionInstruction.startsWith("else-") ||
                      selectedMissionInstruction === "0" ||
                      /^T\d+$/.test(selectedMissionInstruction || "")
                    }
                    style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    title="View and edit the raw JSON for this instruction"
                    data-explanation-id="admin-mission-view-json"
                  >
                    JSON
                  </button>
                  <div style={{ display: "flex", gap: "var(--space-0)" }} className={styles0.div1}>
                    <div ref={linkEditMenuRef} className={styles0.linkEditMenuWrapper}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedMissionInstruction) {
                            alert("Please select an instruction from the list using the radio button first");
                            return;
                          }
                          if (isSelectedLinkType) {
                            setShowLinkEditMenu((prev) => !prev);
                          } else {
                            handleEditInstruction(selectedMissionInstruction);
                          }
                        }}
                        className={styles.addButton}
                        disabled={
                          !selectedMissionInstruction ||
                          createAndEditFetcher.state !== "idle" ||
                          selectedMissionInstruction.startsWith("if-") ||
                          selectedMissionInstruction.startsWith("end-if-") ||
                          selectedMissionInstruction.startsWith("else-")
                        }
                        style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                        title={
                          isSelectedLinkType
                            ? "This is a link instruction — click to choose an action"
                            : selectedMissionInstruction && /^T\d+$/.test(selectedMissionInstruction)
                            ? "Create a real instruction from this temporary entry and open it for editing"
                            : "Edit this instruction"
                        }
                        data-explanation-id="admin-mission-edit-instruction"
                      >
                        {createAndEditFetcher.state !== "idle" && pendingTempEdit?.tempId === selectedMissionInstruction
                          ? "Creating..."
                          : isSelectedLinkType
                          ? "Edit ▾"
                          : "Edit"}
                      </button>
                      {showLinkEditMenu && isSelectedLinkType && (
                        <div className={styles0.linkEditDropdown}>
                          <button
                            type="button"
                            className={styles0.linkEditDropdownItem}
                            onClick={() => {
                              setShowLinkEditMenu(false);
                              onNavigationRequest(() => {
                                if (selectedMissionId) {
                                  localStorage.setItem("lastSelectedMissionId", selectedMissionId);
                                }
                                window.location.href = `/admin/missions?lang=${language}&missionId=${selectedLinkMissionId}`;
                              });
                            }}
                          >
                            🔗 Navigate to linked mission
                          </button>
                          <button
                            type="button"
                            className={styles0.linkEditDropdownItem}
                            onClick={() => {
                              setShowLinkEditMenu(false);
                              handleEditInstruction(selectedMissionInstruction!);
                            }}
                          >
                            ✏️ Edit link instruction
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMissionInstruction) {
                          const instructionData = selectedInstructions.find(
                            ([id]) => id === selectedMissionInstruction,
                          );
                          const currentAltTitle = instructionData?.[1] || "";
                          setRenameInstructionId(selectedMissionInstruction);
                          setAlternativeTitle(currentAltTitle);
                          setShowRenameDialog(true);
                        } else {
                          alert("Please select an instruction from the list using the radio button first");
                        }
                      }}
                      className={styles.addButton}
                      disabled={!selectedMissionInstruction}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                      data-explanation-id="admin-mission-rename-local"
                    >
                      Rename
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    border: "1px solid var(--color-neutral-6)",
                    borderRadius: "var(--radius-2)",
                    padding: "var(--space-2)",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {(() => {
                    // Compute nesting depths for indentation
                    const depthMap = new Map<string, number>();
                    let depth = 0;
                    for (const [id] of selectedInstructions) {
                      if (id.startsWith("end-if-")) {
                        depth = Math.max(0, depth - 1);
                        depthMap.set(id, depth);
                      } else if (id.startsWith("else-")) {
                        depthMap.set(id, Math.max(0, depth - 1));
                      } else if (id.startsWith("if-")) {
                        depthMap.set(id, depth);
                        depth += 1;
                      } else {
                        depthMap.set(id, depth);
                      }
                    }

                    // Build a pair-index map so each IF and its matching END-IF share the same visual badge
                    const ifPairMap = new Map<string, number>(); // id → 1-based pair number
                    let pairCounter = 0;
                    const pairStack: Array<{ ifId: string; pairIdx: number }> = [];
                    for (const [id] of selectedInstructions) {
                      if (id.startsWith("if-")) {
                        pairCounter++;
                        pairStack.push({ ifId: id, pairIdx: pairCounter });
                        ifPairMap.set(id, pairCounter);
                      } else if (id.startsWith("end-if-")) {
                        const top = pairStack[pairStack.length - 1];
                        if (top) {
                          ifPairMap.set(id, top.pairIdx);
                          pairStack.pop();
                        }
                      }
                    }
                    const PAIR_COLORS = [
                      { bg: "var(--indigo-4)", color: "var(--indigo-11)" },
                      { bg: "var(--teal-4)", color: "var(--teal-11)" },
                      { bg: "var(--crimson-4)", color: "var(--crimson-11)" },
                      { bg: "var(--amber-4)", color: "var(--amber-11)" },
                      { bg: "var(--violet-4)", color: "var(--violet-11)" },
                    ];

                    // Build a map: instructionId → owning if- id (for collapse logic)
                    // Also track which else- belongs to which if-
                    const ownerIfMap = new Map<string, string>(); // rowId → ifId that owns/hides it
                    const elseOwnerMap = new Map<string, string>(); // elseId → ifId
                    const stack2: string[] = [];
                    for (const [id] of selectedInstructions) {
                      if (id.startsWith("if-")) {
                        stack2.push(id);
                      } else if (id.startsWith("end-if-")) {
                        const topIf = stack2.pop();
                        if (topIf) ownerIfMap.set(id, topIf);
                      } else if (id.startsWith("else-")) {
                        const suffix = id.replace(/^else-/, "");
                        const matchingIf = `if-${suffix}`;
                        elseOwnerMap.set(id, matchingIf);
                        ownerIfMap.set(id, matchingIf);
                      } else {
                        // Owned by the innermost enclosing IF
                        const topIf = stack2[stack2.length - 1];
                        if (topIf) ownerIfMap.set(id, topIf);
                      }
                    }

                    // IF collapse: hide only the IF-branch (up to ELSE if present, else up to END-IF).
                    // Suffix is always consistent in the new structure.
                    const hiddenDueToIfCollapse = new Set<string>();
                    for (const ifId of collapsedIfIds) {
                      const suffix = ifId.replace(/^if-/, "");
                      const elseId = `else-${suffix}`;
                      const endIfId = `end-if-${suffix}`;
                      const hasElse = selectedInstructions.some(([id]) => id === elseId);
                      const stopId = hasElse ? elseId : endIfId;
                      let inside = false;
                      for (const [id] of selectedInstructions) {
                        if (id === ifId) { inside = true; continue; }
                        if (id === stopId) { inside = false; break; }
                        if (inside) hiddenDueToIfCollapse.add(id);
                      }
                    }

                    // ELSE collapse: hide content between ELSE and END-IF.
                    // Suffix is always consistent in the new structure.
                    const hiddenDueToElseCollapse = new Set<string>();
                    for (const elseId of collapsedElseIds) {
                      const suffix = elseId.replace(/^else-/, "");
                      const endIfId = `end-if-${suffix}`;
                      let inside = false;
                      for (const [id] of selectedInstructions) {
                        if (id === elseId) { inside = true; continue; }
                        if (id === endIfId) { inside = false; break; }
                        if (inside) hiddenDueToElseCollapse.add(id);
                      }
                    }

                    const toggleCollapse = (ifId: string) => {
                      setCollapsedIfIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(ifId)) next.delete(ifId);
                        else next.add(ifId);
                        return next;
                      });
                    };

                    const toggleElseCollapse = (elseId: string) => {
                      setCollapsedElseIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(elseId)) next.delete(elseId);
                        else next.add(elseId);
                        return next;
                      });
                    };

                    return selectedInstructions.map(([instructionId, customTitle], rowIndex) => {
                      // Hide rows that are inside a collapsed IF block
                      if (hiddenDueToIfCollapse.has(instructionId) || hiddenDueToElseCollapse.has(instructionId))
                        return null;
                      const isComment = instructionId.startsWith("comment-") || instructionId === "0";
                      const isIf = instructionId.startsWith("if-");
                      const isEndIf = instructionId.startsWith("end-if-");
                      const isElse = instructionId.startsWith("else-");
                      const isTemp = instructionId.startsWith("T") && /^T\d+$/.test(instructionId);
                      // Strip the duplicate suffix (#2, #3, …) to get the real instruction ID for lookup
                      const baseInstructionId = instructionId.includes("#")
                        ? instructionId.split("#")[0]
                        : instructionId;
                      // Prefer the current-language instruction; in Hebrew mode fall back to English
                      // so that instructions without Hebrew data are still visible in the panel.
                      const primaryInstruction =
                        !isComment && !isIf && !isEndIf && !isElse && !isTemp
                          ? instructions.find((i) => i.id === baseInstructionId)
                          : null;
                      const fallbackInstruction =
                        !isComment &&
                        !isIf &&
                        !isEndIf &&
                        !isElse &&
                        !isTemp &&
                        !primaryInstruction &&
                        language === "he"
                          ? instructionsEn.find((i) => i.id === baseInstructionId)
                          : null;
                      const instruction = primaryInstruction ?? fallbackInstruction;
                      // True when displayed using English data because no Hebrew version exists yet
                      const isEnFallback = language === "he" && !!fallbackInstruction;

                      // Non-special entries must resolve to a real instruction (or be filtered out)
                      if (!isComment && !isIf && !isEndIf && !isElse && !isTemp && !instruction) return null;

                      const displayTitle =
                        isComment || isIf || isEndIf || isElse || isTemp
                          ? customTitle
                          : customTitle || instruction?.title || "";
                      const indentLevel = depthMap.get(instructionId) ?? 0;
                      const isCollapsed = isIf && collapsedIfIds.has(instructionId);
                      const isElseCollapsed = isElse && collapsedElseIds.has(instructionId);
                      const pairIdx = isIf || isEndIf ? ifPairMap.get(instructionId) : undefined;
                      const pairColor =
                        pairIdx !== undefined ? PAIR_COLORS[(pairIdx - 1) % PAIR_COLORS.length] : null;
                      // Count hidden IF-branch children (up to ELSE if present, else up to END-IF).
                      // Suffix is always consistent in the new structure.
                      let hiddenCount = 0;
                      if (isCollapsed) {
                        const cwSuffix = instructionId.replace(/^if-/, "");
                        const cwElseId = `else-${cwSuffix}`;
                        const cwEndIfId = `end-if-${cwSuffix}`;
                        const cwHasElse = selectedInstructions.some(([id]) => id === cwElseId);
                        const cwStopId = cwHasElse ? cwElseId : cwEndIfId;
                        let counting = false;
                        for (const [id] of selectedInstructions) {
                          if (id === instructionId) { counting = true; continue; }
                          if (id === cwStopId) break;
                          if (counting) hiddenCount++;
                        }
                      }
                      // Count hidden ELSE-branch children (ELSE to END-IF).
                      // Suffix is always consistent in the new structure.
                      let elseHiddenCount = 0;
                      if (isElseCollapsed) {
                        const ewSuffix = instructionId.replace(/^else-/, "");
                        const ewEndIfId = `end-if-${ewSuffix}`;
                        let counting = false;
                        for (const [id] of selectedInstructions) {
                          if (id === instructionId) { counting = true; continue; }
                          if (id === ewEndIfId) break;
                          if (counting) elseHiddenCount++;
                        }
                      }
                      return (
                        <label
                          key={`${instructionId}-${rowIndex}`}
                          className={styles.checkboxLabel}
                          style={{
                            paddingTop: "var(--space-2)",
                            paddingBottom: "var(--space-2)",
                            paddingRight: "var(--space-2)",
                            paddingLeft: `calc(var(--space-2) + ${indentLevel * 20}px)`,
                            borderBottom: "1px solid var(--color-neutral-4)",
                            margin: 0,
                            background: isIf
                              ? "var(--color-success-3)"
                              : isEndIf
                                ? "var(--color-neutral-3)"
                                : isElse
                                  ? "var(--color-accent-3)"
                                  : isTemp
                                    ? "var(--color-accent-2)"
                                    : undefined,
                          }}
                        >
                          <input
                            type="radio"
                            name="missionInstructionRadio"
                            checked={selectedMissionInstruction === instructionId}
                            onChange={() => setSelectedMissionInstruction(instructionId)}
                          />
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
                            {isComment ? (
                              <span style={{ color: "var(--color-accent-11)", fontStyle: "italic" }}>💬 Comment:</span>
                            ) : isIf ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleCollapse(instructionId);
                                  }}
                                  title={isCollapsed ? "Expand IF block" : "Collapse IF block"}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "0 2px",
                                    fontSize: "0.75rem",
                                    lineHeight: 1,
                                    color: "var(--color-success-11)",
                                    flexShrink: 0,
                                  }}
                                >
                                  {isCollapsed ? "▶" : "▼"}
                                </button>
                                <span style={{ color: "var(--color-success-11)", fontWeight: 700 }}>🔀 IF:</span>
                                {pairColor && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      minWidth: "16px",
                                      height: "16px",
                                      borderRadius: "50%",
                                      fontSize: "0.65rem",
                                      fontWeight: 700,
                                      lineHeight: 1,
                                      flexShrink: 0,
                                      padding: "0 3px",
                                      background: pairColor.bg,
                                      color: pairColor.color,
                                    }}
                                    title={`IF block #${pairIdx}`}
                                  >
                                    {pairIdx}
                                  </span>
                                )}
                              </>
                            ) : isEndIf ? (
                              <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--color-neutral-10)", fontWeight: 600, opacity: 0.7 }}>
                                {pairColor && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      minWidth: "16px",
                                      height: "16px",
                                      borderRadius: "50%",
                                      fontSize: "0.65rem",
                                      fontWeight: 700,
                                      lineHeight: 1,
                                      flexShrink: 0,
                                      padding: "0 3px",
                                      background: pairColor.bg,
                                      color: pairColor.color,
                                    }}
                                    title={`END-IF for block #${pairIdx}`}
                                  >
                                    {pairIdx}
                                  </span>
                                )}
                                🔁 END-IF{customTitle && customTitle !== "END-IF" ? `: ${customTitle}` : ""}
                              </span>
                            ) : isElse ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleElseCollapse(instructionId);
                                  }}
                                  title={isElseCollapsed ? "Expand ELSE block" : "Collapse ELSE block"}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "0 2px",
                                    fontSize: "0.75rem",
                                    lineHeight: 1,
                                    color: "var(--color-accent-11)",
                                    flexShrink: 0,
                                  }}
                                >
                                  {isElseCollapsed ? "▶" : "▼"}
                                </button>
                                <span style={{ color: "var(--color-accent-11)", fontWeight: 700 }}>
                                  ↔️ ELSE{customTitle ? `: ${customTitle}` : ""}
                                </span>
                                {isElseCollapsed && elseHiddenCount > 0 && (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--color-neutral-9)",
                                      marginLeft: "4px",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    ({elseHiddenCount} hidden)
                                  </span>
                                )}
                              </>
                            ) : isTemp ? (
                              <span
                                style={{ color: "var(--color-accent-10)", fontWeight: 600 }}
                                title="Temporary — not yet saved to DB"
                              >
                                {instructionId}
                              </span>
                            ) : (
                              <span
                                style={{
                                  color:
                                    instruction?.status === "full explanation"
                                      ? "green"
                                      : instruction?.status === "only title"
                                        ? "red"
                                        : "inherit",
                                  fontWeight: 600,
                                }}
                              >
                                {baseInstructionId}
                                {instructionId.includes("#") && (
                                  <span
                                    style={{ color: "var(--color-accent-9)", fontSize: "0.8em", marginLeft: "2px" }}
                                  >
                                    ×{instructionId.split("#")[1]}
                                  </span>
                                )}
                                {isEnFallback && (
                                  <span
                                    title="No Hebrew translation yet — showing English title as fallback"
                                    style={{
                                      marginLeft: "4px",
                                      fontSize: "0.65em",
                                      background: "var(--amber-4)",
                                      color: "var(--amber-11)",
                                      padding: "0 3px",
                                      borderRadius: "2px",
                                      fontWeight: 700,
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    EN
                                  </span>
                                )}
                              </span>
                            )}
                            {!isComment && !isEndIf && !isElse && " "}
                            {!isEndIf && !isElse && displayTitle}
                            {isCollapsed && hiddenCount > 0 && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--color-neutral-9)",
                                  marginLeft: "4px",
                                  fontStyle: "italic",
                                }}
                              >
                                ({hiddenCount} hidden)
                              </span>
                            )}
                            {!isComment && !isIf && !isEndIf && !isElse && !isTemp && customTitle && (
                              <span
                                style={{
                                  color: "var(--color-accent-11)",
                                  fontSize: "0.875rem",
                                  marginLeft: "var(--space-2)",
                                }}
                              >
                                {instruction && `(${instruction.title})`}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.formSection}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-3)",
              }}
            >
              <h2
                className={styles.sectionTitle}
                style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)", margin: 0 }}
              >
                Mission Details
              </h2>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.div7}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Title</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Security Fundamentals"
                  />
                </div>
                <div className={styles.div10}>
                  <div className={classNames(styles.formGroup, styles.div8)}>
                    <label className={styles.label}>Mission ID </label>
                    <input
                      type="text"
                      className={styles.input}
                      value={id}
                      readOnly
                      style={{ cursor: "default", opacity: 0.65 }}
                      title="Mission ID is read-only — assigned automatically by the system"
                      placeholder="e.g., security-basics"
                    />
                  </div>
                </div>
                <div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Mission Status</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                      <select
                        className={styles.input}
                        value={status}
                        onChange={(e) => setStatus(e.target.value as "Hide" | "For all" | "Only Adama" | "Only Bazn")}
                        data-explanation-id="admin-mission-status"
                      >
                        <option value="Hide">Hide</option>
                        <option value="For all">For all</option>
                        <option value="Only Adama">Only Adama</option>
                        <option value="Only Bazn">Only Bazn</option>
                      </select>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                          fontSize: "0.875rem",
                          color: "var(--color-neutral-12)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isExample}
                          onChange={(e) => setIsExample(e.target.checked)}
                          style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          data-explanation-id="admin-mission-is-example"
                        />
                        Example
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Description</label>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter mission description..."
                />
              </div>

              {linkedOutMissionIds.length > 0 && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Links to Missions</label>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--color-neutral-11)",
                      padding: "var(--space-2) 0",
                      lineHeight: 1.6,
                    }}
                  >
                    {linkedOutMissionIds.map((missionId, idx) => {
                      const m = missions.find((mm) => mm.id === missionId);
                      return (
                        <span key={missionId}>
                          {idx > 0 && ", "}
                          <strong
                            style={{
                              cursor: "pointer",
                              textDecoration: "underline",
                              color: "var(--color-accent-11)",
                            }}
                            onClick={() => handleSelectMission(missionId)}
                            title={`Go to mission ${missionId}`}
                          >
                            {missionId}
                          </strong>
                          {m ? ` (${m.title})` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.previewSection}>
            <div
              className={styles.formSection}
              style={{ background: "var(--color-neutral-3)", border: "2px dashed var(--color-neutral-7)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: adminNotes.length > 0 || showNoteInput ? "var(--space-4)" : 0,
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-subheading)",
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "var(--color-neutral-11)",
                    margin: 0,
                  }}
                >
                  🔒 Admin Notes {adminNotes.length > 0 && `(${adminNotes.length})`}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNoteInput((v) => !v)}
                  className={styles.addButton}
                  disabled={!session}
                  style={{ fontSize: "0.8125rem" }}
                  data-explanation-id="admin-mission-add-note"
                >
                  {showNoteInput ? "Cancel" : "+ Admin Note"}
                </button>
              </div>

              {showNoteInput && (
                <div style={{ marginBottom: "var(--space-3)" }}>
                  <textarea
                    className={styles.textarea}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Write an admin note..."
                    style={{ minHeight: "72px", marginBottom: "var(--space-2)" }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                  />
                  <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNoteInput(false);
                        setNewNoteText("");
                      }}
                      className={styles.addButton}
                      style={{ fontSize: "0.8125rem" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNote}
                      className={styles.submitButton}
                      disabled={!newNoteText.trim() || adminNotesFetcher.state !== "idle"}
                      style={{ fontSize: "0.8125rem", padding: "var(--space-2) var(--space-4)" }}
                      data-explanation-id="admin-mission-add-note"
                    >
                      {adminNotesFetcher.state !== "idle" ? "Saving..." : "Add Note"}
                    </button>
                  </div>
                </div>
              )}

              {adminNotes.length > 0 && (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  {adminNotes.map((note, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "var(--space-2)",
                        padding: "var(--space-2) var(--space-3)",
                        background: editingNoteIndex === idx ? "var(--color-accent-2)" : "var(--color-neutral-2)",
                        border:
                          editingNoteIndex === idx
                            ? "1px solid var(--color-accent-7)"
                            : "1px solid var(--color-neutral-6)",
                        borderRadius: "var(--radius-2)",
                      }}
                    >
                      <span
                        style={{
                          marginTop: "2px",
                          fontSize: "0.875rem",
                          color: "var(--color-neutral-10)",
                          flexShrink: 0,
                        }}
                      >
                        ☐
                      </span>
                      {editingNoteIndex === idx ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                          <textarea
                            className={styles.textarea}
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            style={{ minHeight: "60px", fontSize: "0.875rem", marginBottom: 0 }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleSaveEditedNote();
                              } else if (e.key === "Escape") {
                                handleCancelEditNote();
                              }
                            }}
                          />
                          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={handleCancelEditNote}
                              className={styles.addButton}
                              style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditedNote}
                              className={styles.submitButton}
                              disabled={!editingNoteText.trim()}
                              style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span
                          style={{
                            flex: 1,
                            fontFamily: "var(--font-body)",
                            fontSize: "0.875rem",
                            color: "var(--color-neutral-12)",
                            wordBreak: "break-word",
                          }}
                        >
                          {note}
                        </span>
                      )}
                      {editingNoteIndex !== idx && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditNote(idx)}
                            className={styles.addButton}
                            style={{
                              flexShrink: 0,
                              fontSize: "0.75rem",
                              padding: "var(--space-1) var(--space-2)",
                            }}
                            title="Edit note"
                            data-explanation-id="admin-mission-edit-note"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveNote(idx)}
                            className={styles.removeButton}
                            style={{
                              marginRight: 0,
                              flexShrink: 0,
                              fontSize: "0.75rem",
                              padding: "var(--space-1) var(--space-2)",
                            }}
                            title="Remove note"
                            data-explanation-id="admin-mission-delete-note"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {adminNotes.length === 0 && !showNoteInput && (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-neutral-9)", margin: 0, fontStyle: "italic" }}>
                  No admin notes yet. Click &quot;+ Admin Note&quot; to add one.
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-2)",
              }}
            >
              <h2
                className={styles.previewTitle}
                style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)", margin: 0 }}
              >
                Updated Code
              </h2>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  onClick={handleFixDuplicateIds}
                  className={styles.addButton}
                  style={{ fontSize: "0.8125rem", padding: "var(--space-1) var(--space-3)" }}
                  title="Scan the instructions array and assign #2, #3 … suffixes to any duplicate IDs. Does not save — click Apply JSON then Save to persist."
                  data-explanation-id="admin-mission-fix-duplicates"
                >
                  🔧 Fix Duplicate IDs
                </button>
                <button
                  type="button"
                  onClick={handleMigrateIfSuffixes}
                  className={styles.addButton}
                  style={{ fontSize: "0.8125rem", padding: "var(--space-1) var(--space-3)" }}
                  title="Scan IF/ELSE/END-IF blocks and assign consistent suffixes to any mismatched pairs (old-format missions). Does not save — click Save to Database to persist."
                  data-explanation-id="admin-mission-migrate-if-suffixes"
                >
                  🔀 Fix IF Suffixes
                </button>
                <button
                  type="button"
                  onClick={handleApplyCodeEditor}
                  className={styles.submitButton}
                  style={{ fontSize: "0.8125rem", padding: "var(--space-1) var(--space-3)" }}
                  data-explanation-id="admin-mission-apply-json"
                >
                  Apply JSON
                </button>
              </div>
            </div>
            {codeEditorError && (
              <p style={{ margin: "0 0 var(--space-2)", fontSize: "0.8125rem", color: "var(--color-error-11)" }}>
                {codeEditorError}
              </p>
            )}
            <textarea
              className={styles.codeEditor}
              value={codeEditorValue}
              onChange={(e) => {
                setCodeEditorValue(e.target.value);
                setCodeEditorError(null);
              }}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: "400px",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                border: codeEditorError ? "1px solid var(--color-error-8)" : "1px solid var(--color-neutral-6)",
                borderRadius: "var(--radius-2)",
                backgroundColor: "var(--color-neutral-2)",
                color: "var(--color-neutral-12)",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={handleTranslateAndSwitch}
                className={styles.addButton}
                disabled={isTranslating || !title || !description}
                style={{ flex: 1 }}
                data-explanation-id="admin-mission-translate-switch"
              >
                {isTranslating ? "Translating..." : `Translate to ${language === "en" ? "Hebrew" : "English"} & Switch`}
              </button>
            </div>

            <AuthenticatedForm
              actionType="saveMission"
              id={id}
              isExample={isExample}
              data={generateCode()}
              disabled={!id || (language === "en" && !title)}
              language={language}
            />

            {actionData?.success && actionData.message && (
              <div className={styles.successMessage} style={{ marginTop: "var(--space-3)" }}>
                {actionData.message}
              </div>
            )}
            {actionData?.error && (
              <div className={styles.errorMessage} style={{ marginTop: "var(--space-3)" }}>
                {actionData.error}
              </div>
            )}
          </div>
        </>
      )}

      {showRenameDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowRenameDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Rename Instruction for This Mission</h2>
              <button className={styles.dialogClose} onClick={() => setShowRenameDialog(false)}>
                ✕
              </button>
            </div>
            <div className={styles.formGroup} style={{ marginTop: "var(--space-4)" }}>
              <label className={styles.label}>Alternative Title (leave empty to use original title)</label>
              <input
                type="text"
                className={styles.input}
                value={alternativeTitle}
                onChange={(e) => setAlternativeTitle(e.target.value)}
                placeholder="Enter alternative title..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => setShowRenameDialog(false)}
                className={styles.removeButton}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (renameInstructionId) {
                    const newInstructions = selectedInstructions.map(([id, title]) => {
                      if (id === renameInstructionId) {
                        return alternativeTitle.trim()
                          ? ([id, alternativeTitle.trim()] as [string, string])
                          : ([id] as [string, string?]);
                      }
                      return [id, title] as [string, string?];
                    });
                    setSelectedInstructions(newInstructions);
                    setShowRenameDialog(false);
                    setRenameInstructionId(null);
                    setAlternativeTitle("");
                  }
                }}
                className={styles.submitButton}
                style={{ flex: 1 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showCommentDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowCommentDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Add Comment</h2>
              <button className={styles.dialogClose} onClick={() => setShowCommentDialog(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "var(--space-4)" }}>
              <p style={{ marginBottom: "var(--space-3)", color: "var(--color-neutral-11)" }}>
                Add a comment that will appear in the mission's instruction list. These comments are visible to end
                users.
              </p>
              <div className={styles.formGroup}>
                <label className={styles.label}>Comment Text</label>
                <textarea
                  className={styles.textarea}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your comment..."
                  rows={3}
                  autoFocus
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-4)",
                  justifyContent: "flex-end",
                }}
              >
                <button type="button" onClick={() => setShowCommentDialog(false)} className={styles.removeButton}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddComment}
                  className={styles.submitButton}
                  disabled={!commentText.trim()}
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showJsonDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowJsonDialog(false)}>
          <div
            className={styles.dialogContent}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "720px", width: "95vw" }}
          >
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>JSON — Instruction {jsonDialogInstructionId}</h2>
              <button
                type="button"
                onClick={handleSaveJson}
                className={styles.submitButton}
                disabled={isJsonSaving || !session}
              >
                {isJsonSaving ? "Saving..." : "Save to Supabase"}
              </button>
              <button className={styles.dialogClose} onClick={() => setShowJsonDialog(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <textarea
                value={jsonEditorValue}
                onChange={(e) => {
                  setJsonEditorValue(e.target.value);
                  setJsonSaveError(null);
                }}
                spellCheck={false}
                rows={20}
                style={{
                  width: "100%",
                  fontFamily: "monospace",
                  fontSize: "0.8125rem",
                  padding: "var(--space-3)",
                  border: jsonSaveError ? "1px solid var(--color-error-8)" : "1px solid var(--color-neutral-6)",
                  borderRadius: "var(--radius-2)",
                  backgroundColor: "var(--color-neutral-2)",
                  color: "var(--color-neutral-12)",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              {jsonSaveError && (
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-error-11)" }}>{jsonSaveError}</p>
              )}
              {jsonFetcher.data?.success && (
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-success-11)" }}>
                  ✓ Saved successfully!
                </p>
              )}
              {jsonFetcher.data?.error && (
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-error-11)" }}>
                  Error: {jsonFetcher.data.error}
                </p>
              )}
              <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}></div>
            </div>
          </div>
        </div>
      )}

      {showDrawioDialog && (
        <DrawioUploadDialog onClose={() => setShowDrawioDialog(false)} onImport={handleDrawioImport} />
      )}

      {showNewInstructionDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowNewInstructionDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Add New Instruction Title</h2>
              <button className={styles.dialogClose} onClick={() => setShowNewInstructionDialog(false)}>
                ✕
              </button>
            </div>
            <p
              style={{
                padding: "var(--space-3) var(--space-4) 0",
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--color-neutral-10)",
              }}
            >
              A temporary placeholder (e.g. <strong>T1</strong>) will be added to the mission list. No instruction is
              created in the database yet.
            </p>
            <div className={styles.formGroup} style={{ marginTop: "var(--space-3)", padding: "0 var(--space-4)" }}>
              <label className={styles.label}>Instruction Title</label>
              <input
                type="text"
                className={styles.input}
                value={newInstructionTitle}
                onChange={(e) => setNewInstructionTitle(e.target.value)}
                placeholder="Enter instruction title..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newInstructionTitle.trim()) handleAddTempInstruction();
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                marginTop: "var(--space-4)",
                padding: "0 var(--space-4) var(--space-4)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowNewInstructionDialog(false);
                  setNewInstructionTitle("");
                }}
                className={styles.removeButton}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTempInstruction}
                className={styles.submitButton}
                style={{ flex: 1 }}
                disabled={!newInstructionTitle.trim()}
              >
                Add to Mission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
