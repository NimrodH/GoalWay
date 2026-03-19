import { useEffect, useState } from "react";
import { Form, useActionData, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { AdminLayout } from "~/components/admin-layout/admin-layout";
import { useAuth } from "~/hooks/use-auth";
import classNames from "classnames";
import styles from "./admin.module.css";
import { loader as adminLoader, action as adminAction } from "~/routes/admin";
import type { Instruction } from "~/services/instructions.server";
import type { Mission } from "~/services/missions.server";

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
          instructionsEn={loaderData.instructionsEn}
          instructionsHe={loaderData.instructionsHe}
          language={loaderData.language}
          onChangesDetected={onChangesDetected}
          onNavigationRequest={onNavigationRequest}
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
  instructionsEn,
  instructionsHe,
  language,
  onChangesDetected,
  onNavigationRequest,
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
  instructionsEn: Instruction[];
  instructionsHe: Instruction[];
  language: string;
  onChangesDetected: (hasChanges: boolean) => void;
  onNavigationRequest: (navigationFn: () => void) => void;
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
  const [searchParams] = useSearchParams();
  const missionFetcher = useFetcher<typeof action>();
  const instructionFetcher = useFetcher<typeof action>();
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
    if (missionIdFromUrl && allMissionIds.includes(missionIdFromUrl) && selectedMissionId !== missionIdFromUrl) {
      updateMissionFormFields(missionIdFromUrl);
    } else if (!missionIdFromUrl && !selectedMissionId && allMissionIds.length > 0) {
      const lastMissionId = localStorage.getItem("lastSelectedMissionId");
      if (lastMissionId && allMissionIds.includes(lastMissionId)) {
        updateMissionFormFields(lastMissionId);
      }
    }
  }, [searchParams, allMissionIds, selectedMissionId]);

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

  const handleCreateAndAddInstruction = () => {
    if (!newInstructionTitle.trim()) {
      alert("Please enter a title for the new instruction");
      return;
    }

    const allIds = instructions.map((i) => i.id);
    const numericIds = allIds.map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const newId = String(maxId + 1);

    const newInstruction = {
      id: newId,
      title: newInstructionTitle.trim(),
      explanation: [],
    };

    const updatedInstructions = [...selectedInstructions, [newId]];
    const updatedMission = {
      id,
      title,
      description,
      instructions: updatedInstructions,
    };

    const instructionFormData = new FormData();
    instructionFormData.append("actionType", "saveInstruction");
    instructionFormData.append("id", newId);
    instructionFormData.append("dataEn", JSON.stringify(newInstruction));
    instructionFormData.append("language", language);
    instructionFormData.append("accessToken", session?.access_token || "");

    (window as any).__pendingMissionUpdate = {
      missionId: selectedMissionId,
      missionData: JSON.stringify(updatedMission),
      language,
      accessToken: session?.access_token || "",
    };

    instructionFetcher.submit(instructionFormData, { method: "post" });
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
    if (instructionFetcher.data && instructionFetcher.state === "idle") {
      if (instructionFetcher.data.success) {
        const pendingMissionUpdate = (window as any).__pendingMissionUpdate;
        if (pendingMissionUpdate) {
          const missionFormData = new FormData();
          missionFormData.append("actionType", "saveMission");
          missionFormData.append("id", pendingMissionUpdate.missionId);
          missionFormData.append("dataEn", pendingMissionUpdate.missionData);
          missionFormData.append("language", pendingMissionUpdate.language);
          missionFormData.append("accessToken", pendingMissionUpdate.accessToken);

          delete (window as any).__pendingMissionUpdate;

          setShowNewInstructionDialog(false);
          setNewInstructionTitle("");

          fetch("/admin", {
            method: "POST",
            body: missionFormData,
          }).then(() => {
            window.location.href = `/admin/missions?lang=${language}&missionId=${selectedMissionId}`;
          });
        } else if (instructionFetcher.data.newInstructionId) {
          window.location.href = `/admin/instructions?lang=${language}&instructionId=${instructionFetcher.data.newInstructionId}`;
        }
      } else if (instructionFetcher.data.error) {
        alert(`Failed to create instruction: ${instructionFetcher.data.error}`);
      }
    }
  }, [instructionFetcher.data, instructionFetcher.state, language, selectedMissionId]);

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
          <h2 className={styles.sectionTitle} style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)" }}>
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
                          {instruction.id} - {instruction.title}
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
                  →
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
                  ←
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
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
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
                      onClick={() => {
                        if (selectedMissionInstruction) {
                          if (selectedMissionId) {
                            localStorage.setItem("lastSelectedMissionId", selectedMissionId);
                          }
                          onNavigationRequest(() => {
                            window.location.href = `/admin/instructions?lang=${language}&instructionId=${selectedMissionInstruction}`;
                          });
                        } else {
                          alert("Please select an instruction from the list using the radio button first");
                        }
                      }}
                      className={styles.addButton}
                      disabled={!selectedMissionInstruction}
                      style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
                    >
                      Edit
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
                      onClick={() => {
                        if (selectedMissionInstruction) {
                          const instructionData = selectedInstructions.find(([id]) => id === selectedMissionInstruction);
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
                    const instruction = !isComment ? instructions.find((i) => i.id === instructionId) : null;

                    if (!isComment && !instruction) return null;

                    const displayTitle = isComment ? customTitle : customTitle || instruction?.title || "";
                    return (
                      <label
                        key={instructionId}
                        className={styles.checkboxLabel}
                        style={{
                          padding: "var(--space-2)",
                          borderBottom: "1px solid var(--color-neutral-4)",
                          margin: 0,
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
                          ) : (
                            <span style={{ color: instruction?.status === "full explanation" ? "green" : "inherit" }}>
                              {instructionId}
                            </span>
                          )}
                          {!isComment && " - "}
                          {displayTitle}
                          {!isComment && customTitle && (
                            <span
                              style={{
                                color: "var(--color-accent-11)",
                                fontSize: "0.875rem",
                                marginLeft: "var(--space-2)",
                              }}
                            >
                              {!isComment && instruction && `(${instruction.title})`}
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
            <h2 className={styles.sectionTitle} style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)" }}>
              Mission Details
            </h2>
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
            <h2 className={styles.previewTitle} style={{ color: hasUnsavedChangesMission ? "red" : "var(--color-neutral-12)" }}>
              Updated Code
            </h2>
            <textarea
              className={styles.codeEditor}
              value={generateCode()}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setId(parsed.id || "");
                  setTitle(parsed.title || "");
                  setDescription(parsed.description || "");
                  setStatus(parsed.status || "For all");
                  setIsExample(parsed.isExample ?? false);
                  setSelectedInstructions(parsed.instructions || []);
                } catch (err) {
                }
              }}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: "400px",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                border: "1px solid var(--color-neutral-6)",
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

      {showNewInstructionDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowNewInstructionDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Create New Instruction</h2>
              <button className={styles.dialogClose} onClick={() => setShowNewInstructionDialog(false)}>
                ✕
              </button>
            </div>
            <div className={styles.formGroup} style={{ marginTop: "var(--space-4)" }}>
              <label className={styles.label}>Instruction Title</label>
              <input
                type="text"
                className={styles.input}
                value={newInstructionTitle}
                onChange={(e) => setNewInstructionTitle(e.target.value)}
                placeholder="Enter instruction title..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => setShowNewInstructionDialog(false)}
                className={styles.removeButton}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAndAddInstruction}
                className={styles.submitButton}
                style={{ flex: 1 }}
                disabled={!newInstructionTitle.trim()}
              >
                Create & Add to Mission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
