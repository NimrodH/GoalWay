import { useState, useEffect } from "react";
import { data, redirect, Link, useNavigate, useLocation } from "react-router";
import type { Route } from "./+types/missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";
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

  const profile = await getUserProfile(request);

  // Admins bypass all access checks
  if (!profile || !isAdmin(profile)) {
    const hasAccess = await checkMissionAccess(params.missionId, profile?.organization_id ?? null);
    if (!hasAccess) {
      throw redirect("/unauthorized");
    }
  }

  const allMissions = await getAllMissions();
  const instructionIds = mission.instructions.map(([id]) => id);
  const instructions = await getInstructionsByIds(instructionIds);

  return { mission, instructions, allMissions };
}

export default function MissionPage({ loaderData }: Route.ComponentProps) {
  const { mission, instructions, allMissions } = loaderData;

  // Map instructions to maintain order from mission.instructions and apply custom titles
  // Comments (ID "0") are handled separately as they don't exist in the database
  const missionInstructions = mission.instructions
    .map(([id, customTitle]) => {
      // Handle comments (ID starts with "comment-" or is "0" for legacy comments) - they don't have a database entry
      if (id.startsWith("comment-") || id === "0") {
        return {
          id: "0",
          title: customTitle || "",
          description: "",
          status: "comment" as const,
          type: "comment" as const,
          explanation: [], // Comments don't have explanations
        };
      }

      const instruction = instructions.find((inst) => inst.id === id);
      if (!instruction) return null;
      return customTitle ? { ...instruction, title: customTitle } : instruction;
    })
    .filter(Boolean) as (
    | (typeof instructions)[number]
    | { id: string; title: string; description: string; status: "comment"; type: "comment"; explanation: [] }
  )[];

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  const [expandedLinkInstructions, setExpandedLinkInstructions] = useState<Map<string, Instruction[]>>(new Map());
  const [loadingLinkInstructions, setLoadingLinkInstructions] = useState<Set<string>>(new Set());
  const [completedInstructions, setCompletedInstructions] = useState<Set<string>>(new Set());

  // Reset completion state when navigating away from the mission
  useEffect(() => {
    // Cleanup function runs when component unmounts (user navigates away)
    return () => {
      // Clear completion state for this mission when leaving
      if (typeof window !== "undefined") {
        localStorage.removeItem(`completed-${mission.id}`);
      }
    };
  }, [mission.id]);

  const navigate = useNavigate();
  const location = useLocation();

  // Get the previous mission from location state or default to home
  const previousMissionId = (location.state as { from?: string })?.from;

  const handleLinkInstructionClick = async (instructionId: string, linkedMissionId: string) => {
    // Toggle expansion state
    if (expandedLinkInstructions.has(instructionId)) {
      // Collapse - remove from map
      const newMap = new Map(expandedLinkInstructions);
      newMap.delete(instructionId);
      setExpandedLinkInstructions(newMap);
    } else {
      // Expand - fetch linked mission instructions
      setLoadingLinkInstructions(new Set([...loadingLinkInstructions, instructionId]));

      try {
        // Fetch linked mission data
        const response = await fetch(`/api/missions/${linkedMissionId}`);
        if (!response.ok) {
          console.error("Failed to fetch linked mission");
          return;
        }

        const linkedMissionData = await response.json();
        const linkedMission = linkedMissionData.mission;
        const linkedInstructions = linkedMissionData.instructions;

        // Map linked mission instructions with custom titles
        const linkedMissionInstructions = linkedMission.instructions
          .map(([id, customTitle]: [string, string?]) => {
            const instruction = linkedInstructions.find((inst: Instruction) => inst.id === id);
            if (!instruction) return null;
            return customTitle ? { ...instruction, title: customTitle } : instruction;
          })
          .filter(Boolean) as Instruction[];

        // Add to expanded map
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

    // If Shift key is pressed, navigate to admin page with instruction selected
    if (event?.shiftKey) {
      navigate(`/admin?tab=instructions&instructionId=${instructionId}`);
      return;
    }

    // If it's a link type instruction, expand/collapse inline
    if (instruction?.type === "link" && instruction.missionId) {
      handleLinkInstructionClick(instructionId, instruction.missionId);
      return;
    }

    // Otherwise, toggle selection as usual
    if (selectedInstructionId === instructionId) {
      setSelectedInstructionId(null);
      // Mark instruction as completed when closed
      setCompletedInstructions((prev) => new Set([...prev, instructionId]));
    } else {
      // Mark previously selected instruction as completed when switching to another
      if (selectedInstructionId) {
        setCompletedInstructions((prev) => new Set([...prev, selectedInstructionId]));
      }
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

  // Don't pass comments to ExplanationDisplay - they don't have explanations
  const instructionToDisplay = selectedInstruction?.type === "comment" ? null : selectedInstruction;

  // Scroll selected instruction to top after render
  useEffect(() => {
    if (selectedInstructionId) {
      // Use requestAnimationFrame to ensure the DOM has been updated
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-instruction-id="${selectedInstructionId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  }, [selectedInstructionId]);

  return (
    <div className={styles.container}>
      <section className={styles.instructionListSection}>
        <div className={styles.headerWrapper}>
          <Link to="/" className={styles.menuLink}>
            <BookOpen size={18} />
            View All Missions
          </Link>
          {previousMissionId && (
            <button onClick={handleBackClick} className={styles.menuLink}>
              <ArrowLeft size={18} />
              Back to Previous Mission
            </button>
          )}
          <h1 className={styles.sectionHeader}>{mission.title}</h1>
        </div>
        <p className={styles.missionDescription}>{mission.description}</p>
        <div className={styles.instructionList}>
          {missionInstructions.map((instruction, index) => {
            const isComment = instruction.type === "comment";
            const isExpanded = expandedLinkInstructions.has(instruction.id);
            const isLoading = loadingLinkInstructions.has(instruction.id);
            const expandedInstructions = expandedLinkInstructions.get(instruction.id);

            // Calculate order number (excluding comments)
            const orderNumber = missionInstructions
              .slice(0, index + 1)
              .filter((inst) => inst.type !== "comment").length;

            // Render comments differently (non-clickable, styled)
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
                    <span style={{ marginRight: "var(--space-2)" }}>💬</span>
                    <span>{instruction.title}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={instruction.id}>
                <div className={styles.instructionItem} data-instruction-id={instruction.id}>
                  <InstructionListItem
                    title={instruction.title}
                    description={instruction.description}
                    selected={selectedInstructionId === instruction.id}
                    onClick={(event) => handleInstructionClick(instruction.id, event)}
                    instructionType={instruction.type}
                    explanation={"explanation" in instruction ? instruction.explanation : []}
                    className={styles.instructionListItem}
                    orderNumber={orderNumber}
                    isCompleted={completedInstructions.has(instruction.id)}
                  />
                  {instruction.type === "link" && "missionId" in instruction && (
                    <div style={{ marginLeft: "1rem", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
                      {isLoading ? "Loading..." : isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                  {selectedInstructionId === instruction.id &&
                    instruction.type !== "link" &&
                    !isComment &&
                    "explanation" in instruction &&
                    instruction.explanation.length > 0 && (
                      <div className={styles.mobileExplanation}>
                        <ExplanationDisplay instruction={instruction as Instruction} />
                      </div>
                    )}
                </div>

                {/* Render expanded linked mission instructions */}
                {isExpanded && expandedInstructions && (
                  <div style={{ marginLeft: "2rem", marginTop: "0.5rem", marginBottom: "1rem" }}>
                    {expandedInstructions.map((linkedInstruction, linkedIndex) => (
                      <div
                        key={linkedInstruction.id}
                        className={styles.instructionItem}
                        data-instruction-id={linkedInstruction.id}
                      >
                        <InstructionListItem
                          title={linkedInstruction.title}
                          description={linkedInstruction.description}
                          selected={selectedInstructionId === linkedInstruction.id}
                          instructionType={linkedInstruction.type}
                          explanation={linkedInstruction.explanation}
                          orderNumber={linkedIndex + 1}
                          isCompleted={completedInstructions.has(linkedInstruction.id)}
                          onClick={(event) => {
                            // If Shift key is pressed, navigate to admin page
                            if (event?.shiftKey) {
                              navigate(`/admin?tab=instructions&instructionId=${linkedInstruction.id}`);
                              return;
                            }
                            // Toggle selection
                            if (selectedInstructionId === linkedInstruction.id) {
                              setSelectedInstructionId(null);
                              // Mark instruction as completed when closed
                              setCompletedInstructions((prev) => new Set([...prev, linkedInstruction.id]));
                            } else {
                              // Mark previously selected instruction as completed when switching to another
                              if (selectedInstructionId) {
                                setCompletedInstructions((prev) => new Set([...prev, selectedInstructionId]));
                              }
                              setSelectedInstructionId(linkedInstruction.id);
                            }
                          }}
                        />
                        {selectedInstructionId === linkedInstruction.id && linkedInstruction.type !== "link" && (
                          <div className={styles.mobileExplanation}>
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

      <section className={styles.explanationSection}>
        <ExplanationDisplay instruction={instructionToDisplay} className={styles.explanationContainer} />
      </section>
    </div>
  );
}
