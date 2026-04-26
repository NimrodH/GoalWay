import { useEffect, useState } from "react";
import { Form, useActionData, useFetcher, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { AdminLayout } from "~/components/admin-layout/admin-layout";
import { useAuth } from "~/hooks/use-auth";
import classNames from "classnames";
import styles from "./admin.module.css";
import { loader as adminLoader, action as adminAction } from "~/routes/admin";
import type { Instruction } from "~/services/instructions.server";
import type { Mission } from "~/services/missions.server";
import styles0 from "./admin.missions.module.css";

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
          allMissionIds={loaderData.allMissionIds}
          allInstructionIds={loaderData.allInstructionIds}
          instructionsEn={loaderData.instructionsEn}
          instructionsHe={loaderData.instructionsHe}
          language={loaderData.language}
          onChangesDetected={onChangesDetected}
          onNavigationRequest={onNavigationRequest}
          missionAdminNotesMap={loaderData.missionAdminNotesMap}
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
    <Form method="post" style={{ marginTop: "var(--space-4)" }}>
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
  allMissionIds,
  allInstructionIds,
  instructionsEn,
  instructionsHe,
  language,
  onChangesDetected,
  onNavigationRequest,
  missionAdminNotesMap,
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
  allMissionIds: string[];
  allInstructionIds: string[];
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
  missionAdminNotesMap: Record<string, string[]>;
}) {
  const navigate = useNavigate();
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
  const [searchParams] = useSearchParams();
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
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [jsonDialogInstructionId, setJsonDialogInstructionId] = useState<string | null>(null);
  const [jsonEditorValue, setJsonEditorValue] = useState("");
  const [jsonSaveError, setJsonSaveError] = useState<string | null>(null);
  const jsonFetcher = useFetcher<typeof action>();
  const duplicateMissionFetcher = useFetcher<typeof action>();
  const [codeEditorValue, setCodeEditorValue] = useState("");
  const [codeEditorError, setCodeEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMissionId) {
      const currentCode = generateCode();
      if (originalCode === "") {
        setOriginalCode(currentCode);
      } else {
        onChangesDetected(currentCode !== originalCode);
      }
    }
  }, [id, title, description, status, selectedInstructions, selectedMissionId]);

  useEffect(() => {
    if (actionData?.success || selectedMissionId) {
      setOriginalCode(generateCode());
      onChangesDetected(false);
    }
  }, [actionData, selectedMissionId]);

  useEffect(() => {
    const missionIdFromUrl = searchParams.get("missionId");
    if (missionIdFromUrl && allMissionIds.includes(missionIdFromUrl)) {
      updateMissionFormFields(missionIdFromUrl);
    } else if (!missionIdFromUrl && allMissionIds.length > 0) {
      const lastMissionId = localStorage.getItem("lastSelectedMissionId");
      if (lastMissionId && allMissionIds.includes(lastMissionId)) {
        updateMissionFormFields(lastMissionId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allMissionIds]);

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
          ...selectedInstructions.slice(0, selectedIndex),
          [tempId, newInstructionTitle.trim()],
          ...selectedInstructions.slice(selectedIndex),
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
    const ifId = `if-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const defaultText = "IF";

    let updatedInstructions: Array<[string, string?]>;
    if (selectedMissionInstruction) {
      const selectedIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
      if (selectedIndex !== -1) {
        updatedInstructions = [
          ...selectedInstructions.slice(0, selectedIndex + 1),
          [ifId, defaultText],
          ...selectedInstructions.slice(selectedIndex + 1),
        ];
      } else {
        updatedInstructions = [...selectedInstructions, [ifId, defaultText]];
      }
    } else {
      updatedInstructions = [...selectedInstructions, [ifId, defaultText]];
    }
    setSelectedInstructions(updatedInstructions);
    setSelectedMissionInstruction(ifId);
  };

  const handleAddEndIf = () => {
    const endIfId = `end-if-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let updatedInstructions: Array<[string, string?]>;
    if (selectedMissionInstruction) {
      const selectedIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
      if (selectedIndex !== -1) {
        updatedInstructions = [
          ...selectedInstructions.slice(0, selectedIndex + 1),
          [endIfId, "END-IF"],
          ...selectedInstructions.slice(selectedIndex + 1),
        ];
      } else {
        updatedInstructions = [...selectedInstructions, [endIfId, "END-IF"]];
      }
    } else {
      updatedInstructions = [...selectedInstructions, [endIfId, "END-IF"]];
    }
    setSelectedInstructions(updatedInstructions);
    setSelectedMissionInstruction(endIfId);
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
      setId(missionId);
      setTitle("");
      setDescription("");
      setStatus("For all");
      setIsExample(false);
      setSelectedInstructions([]);
    }
    // Load admin notes for this mission
    setAdminNotes(missionAdminNotesMap[missionId] || []);
    setShowNoteInput(false);
    setNewNoteText("");
  };

  const handleSelectMission = (missionId: string) => {
    clearActionData();
    updateMissionFormFields(missionId);
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
    if (createAndEditFetcher.data && createAndEditFetcher.state === "idle" && pendingTempEdit) {
      const result = createAndEditFetcher.data;
      if (result.success && result.newInstructionId) {
        const newId = result.newInstructionId;
        const { tempId } = pendingTempEdit;
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
          window.location.href = `/admin/instructions?lang=${language}&instructionId=${newId}`;
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
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${instructionId}`;
      } else if (result.error) {
        alert(`Warning: Instruction created but mission save failed: ${result.error}`);
        const instructionId = pendingNavigateToInstructionId;
        setPendingNavigateToInstructionId(null);
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${instructionId}`;
      }
    }
  }, [
    saveMissionAfterCreateFetcher.data,
    saveMissionAfterCreateFetcher.state,
    pendingNavigateToInstructionId,
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

  const handleEditInstruction = (instructionId: string) => {
    const isTemp = /^T\d+$/.test(instructionId);

    if (!isTemp) {
      // Existing instruction — navigate directly
      if (selectedMissionId) {
        localStorage.setItem("lastSelectedMissionId", selectedMissionId);
      }
      onNavigationRequest(() => {
        window.location.href = `/admin/instructions?lang=${language}&instructionId=${instructionId}`;
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
    const isTemp = /^T\d+$/.test(selectedMissionInstruction);
    if (isComment || isIf || isEndIf || isTemp) {
      alert("JSON editing is only available for real saved instructions");
      return;
    }
    const allInstructions = language === "he" ? instructionsHe : instructionsEn;
    const instruction = allInstructions.find((i) => i.id === selectedMissionInstruction);
    const jsonValue = instruction ? JSON.stringify(instruction, null, 2) : `{ "id": "${selectedMissionInstruction}" }`;
    setJsonDialogInstructionId(selectedMissionInstruction);
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
            >
              {deleteMissionFetcher.state !== "idle" ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={handleDuplicateMission}
              className={styles.addButton}
              disabled={!selectedMissionId || duplicateMissionFetcher.state !== "idle" || !session}
              title="Create a copy of the selected mission with a new ID"
            >
              {duplicateMissionFetcher.state !== "idle" ? "Duplicating..." : "Duplicate Mission"}
            </button>
            <button
              type="button"
              onClick={handleSelectLastMission}
              className={styles.addButton}
              disabled={!localStorage.getItem("lastSelectedMissionId")}
            >
              Select Last Mission
            </button>
            <button
              type="button"
              onClick={handleClearForNewMission}
              className={styles.addButton}
              disabled={missionFetcher.state !== "idle" || !session}
            >
              {missionFetcher.state !== "idle" ? "Creating..." : "+ Create New Mission"}
            </button>
          </div>
        </div>
        <select
          className={styles.input}
          value={selectedMissionId}
          onChange={(e) => handleSelectMission(e.target.value)}
        >
          <option value="">Select a mission...</option>
          {allMissionIds.map((id) => {
            const mission = missions.find((m) => m.id === id);
            const isHidden = mission?.status === "Hide";
            return (
              <option key={id} value={id}>
                {isHidden && "🔴 "}
                {id}
                {mission ? ` - ${mission.title}` : " (No data for this language)"}
              </option>
            );
          })}
        </select>
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
                  >
                    Clear
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
                    .filter((instruction) => !selectedInstructions.some(([id]) => id === instruction.id))
                    .filter((instruction) => {
                      if (!instructionFilter.trim()) return true;
                      const searchTerm = instructionFilter.toLowerCase().trim();
                      const title = instruction.title?.toLowerCase() || "";
                      const description = instruction.description?.toLowerCase() || "";
                      return title.includes(searchTerm) || description.includes(searchTerm);
                    })
                    .map((instruction) => (
                      <label
                        key={instruction.id}
                        className={styles.checkboxLabel}
                        style={{
                          padding: "var(--space-2)",
                          borderBottom: "1px solid var(--color-neutral-4)",
                          margin: 0,
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
                          {" - "}{instruction.title}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }} className={styles.div2}>
                <button
                  type="button"
                  onClick={() => {
                    let newInstructions;
                    if (selectedMissionInstruction) {
                      const insertIndex = selectedInstructions.findIndex(([id]) => id === selectedMissionInstruction);
                      newInstructions = [
                        ...selectedInstructions.slice(0, insertIndex),
                        ...selectedAvailableInstructions.map((id) => [id] as [string, string?]),
                        ...selectedInstructions.slice(insertIndex),
                      ];
                    } else {
                      newInstructions = [
                        ...selectedInstructions,
                        ...selectedAvailableInstructions.map((id) => [id] as [string, string?]),
                      ];
                    }
                    setSelectedInstructions(newInstructions);
                    setSelectedAvailableInstructions([]);
                  }}
                  className={styles.addButton}
                  style={{ width: "80px" }}
                  disabled={selectedAvailableInstructions.length === 0}
                >
                  Add →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedMissionInstruction || !selectedAvailableInstructions.length) return;
                    const isTemp = /^T\d+$/.test(selectedMissionInstruction);
                    if (!isTemp) return;
                    const replacementId = selectedAvailableInstructions[0];
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
                >
                  Link →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMissionInstruction) {
                      setSelectedInstructions(selectedInstructions.filter(([id]) => id !== selectedMissionInstruction));
                      setSelectedMissionInstruction(null);
                    }
                  }}
                  className={styles.addButton}
                  style={{ width: "80px" }}
                  disabled={!selectedMissionInstruction}
                >
                  ← Del
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
                >
                  ↑ Up
                </button>
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
                >
                  ↓ Down
                </button>
                <button
                  type="button"
                  onClick={handleAddIf}
                  className={styles.addButton}
                  disabled={!selectedMissionId || !session}
                  title="Insert an IF conditional block after the selected instruction"
                  style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)", marginTop: "var(--space-2)" }}
                >
                  🔀 IF
                </button>
                <button
                  type="button"
                  onClick={handleAddEndIf}
                  className={styles.addButton}
                  disabled={!selectedMissionId || !session}
                  title="Insert an END-IF marker after the selected instruction"
                  style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                >
                  🔁 END-IF
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
                  <div style={{ display: "flex", gap: "var(--space-0)" }} className={styles0.div1}>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMissionInstruction) {
                          handleEditInstruction(selectedMissionInstruction);
                        } else {
                          alert("Please select an instruction from the list using the radio button first");
                        }
                      }}
                      className={styles.addButton}
                      disabled={
                        !selectedMissionInstruction ||
                        createAndEditFetcher.state !== "idle" ||
                        selectedMissionInstruction.startsWith("if-") ||
                        selectedMissionInstruction.startsWith("end-if-")
                      }
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                      title={
                        selectedMissionInstruction && /^T\d+$/.test(selectedMissionInstruction)
                          ? "Create a real instruction from this temporary entry and open it for editing"
                          : "Edit this instruction"
                      }
                    >
                      {createAndEditFetcher.state !== "idle" && pendingTempEdit?.tempId === selectedMissionInstruction
                        ? "Creating..."
                        : "Edit"}
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
                        selectedMissionInstruction === "0" ||
                        /^T\d+$/.test(selectedMissionInstruction || "")
                      }
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                      title="View and edit the raw JSON for this instruction"
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewInstructionDialog(true)}
                      className={styles.addButton}
                      disabled={!selectedMissionId || !session}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      + New
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCommentDialog(true)}
                      className={styles.addButton}
                      disabled={!selectedMissionId || !session}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      💬 Comment
                    </button>
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
                  {selectedInstructions.map(([instructionId, customTitle]) => {
                    const isComment = instructionId.startsWith("comment-") || instructionId === "0";
                    const isIf = instructionId.startsWith("if-");
                    const isEndIf = instructionId.startsWith("end-if-");
                    const isTemp = instructionId.startsWith("T") && /^T\d+$/.test(instructionId);
                    const instruction = !isComment && !isIf && !isEndIf && !isTemp ? instructions.find((i) => i.id === instructionId) : null;

                    if (!isComment && !isIf && !isEndIf && !isTemp && !instruction) return null;

                    const displayTitle = isComment || isIf || isEndIf || isTemp ? customTitle : customTitle || instruction?.title || "";
                    return (
                      <label
                        key={instructionId}
                        className={styles.checkboxLabel}
                        style={{
                          padding: "var(--space-2)",
                          borderBottom: "1px solid var(--color-neutral-4)",
                          margin: 0,
                          background: isIf
                            ? "var(--color-success-3)"
                            : isEndIf
                            ? "var(--color-neutral-3)"
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
                        <span>
                          {isComment ? (
                            <span style={{ color: "var(--color-accent-11)", fontStyle: "italic" }}>💬 Comment:</span>
                          ) : isIf ? (
                            <span style={{ color: "var(--color-success-11)", fontWeight: 700 }}>🔀 IF:</span>
                          ) : isEndIf ? (
                            <span style={{ color: "var(--color-neutral-10)", fontWeight: 600, opacity: 0.7 }}>🔁 END-IF</span>
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
                              {instructionId}
                            </span>
                          )}
                          {!isComment && !isEndIf && " "}
                          {!isEndIf && displayTitle}
                          {!isComment && !isIf && !isEndIf && !isTemp && customTitle && (
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
                  })}
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
              <button
                type="button"
                onClick={() =>
                  onNavigationRequest(() => {
                    navigate(`/missions/${id}?preview=true`);
                  })
                }
                className={styles.addButton}
                disabled={!id}
                title="Preview this mission in the public view"
                style={{ fontSize: "0.8125rem" }}
              >
                👁 Preview
              </button>
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
                    <label className={styles.label}>Mission ID</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={id}
                      onChange={(e) => setId(e.target.value)}
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
              <button
                type="button"
                onClick={handleApplyCodeEditor}
                className={styles.submitButton}
                style={{ fontSize: "0.8125rem", padding: "var(--space-1) var(--space-3)" }}
              >
                Apply JSON
              </button>
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
                border: codeEditorError
                  ? "1px solid var(--color-error-8)"
                  : "1px solid var(--color-neutral-6)",
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
              >
                {isTranslating ? "Translating..." : `Translate to ${language === "en" ? "Hebrew" : "English"} & Switch`}
              </button>
            </div>

            <AuthenticatedForm
              actionType="saveMission"
              id={id}
              isExample={isExample}
              data={generateCode()}
              disabled={!id || !title}
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
              <div className={styles.formGroup}>
                <label className={styles.label}>Comment Text</label>
                <input
                  type="text"
                  className={styles.input}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter comment text..."
                  autoFocus
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  justifyContent: "flex-end",
                  marginTop: "var(--space-4)",
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
              <h2 className={styles.dialogTitle}>Add Comment to Mission</h2>
              <button className={styles.dialogClose} onClick={() => setShowCommentDialog(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "var(--space-4)" }}>
              <p style={{ marginBottom: "var(--space-3)", color: "var(--color-neutral-11)" }}>
                Add a comment that will appear in the mission's instruction list. Comments are mission-specific and are
                not saved to the instructions table.
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
