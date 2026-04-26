import { useState, useEffect } from "react";
import { data, redirect, Link, useNavigate, useLocation, useSearchParams } from "react-router";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Route } from "./+types/missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown, LayoutGrid, List, GitBranch } from "lucide-react";
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
  const instructionIds = mission.instructions.map(([id]) => id);
  const instructions = await getInstructionsByIds(instructionIds);

  return { mission, instructions, allMissions, isPreview };
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

type MissionInstruction =
  | (typeof import("../services/instructions.server")["getInstructionsByIds"] extends (...args: any) => Promise<infer R> ? R : never)[number]
  | CommentEntry
  | IfEntry
  | EndIfEntry;

export default function MissionPage({ loaderData }: Route.ComponentProps) {
  const { mission, instructions, allMissions, isPreview } = loaderData;

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
      const instruction = instructions.find((inst) => inst.id === id);
      if (!instruction) return null;
      return customTitle ? { ...instruction, title: customTitle } : instruction;
    })
    .filter(Boolean) as (NonNullable<ReturnType<typeof instructions["find"]>> | CommentEntry | IfEntry | EndIfEntry)[];

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

  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
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

  // Don't pass comments or IF entries to ExplanationDisplay
  const instructionToDisplay =
    selectedInstruction &&
    "type" in selectedInstruction &&
    (selectedInstruction.type === "comment" || selectedInstruction.type === "if")
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
        <div className={styles.previewBar}>
          <button
            onClick={() => navigate(`/admin/missions?missionId=${mission.id}`)}
            className={styles.menuLink}
          >
            <ArrowLeft size={18} />
            Back to Admin
          </button>
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
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleButton} ${viewMode === "cards" ? styles.viewToggleActive : ""}`}
                onClick={() => setViewMode("cards")}
                title="Card view"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className={`${styles.viewToggleButton} ${viewMode === "list" ? styles.viewToggleActive : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <List size={18} />
              </button>
            </div>
          </div>
          {viewMode === "cards" && (
            <div className={styles.missionDescription}>
              <Markdown remarkPlugins={[remarkBreaks]}>{mission.description}</Markdown>
            </div>
          )}
          <div className={styles.instructionList}>
            {missionInstructions.map((instruction, index) => {
              const isComment = "type" in instruction && instruction.type === "comment";
              const isIf = "type" in instruction && instruction.type === "if";
              const isEndIf = "type" in instruction && instruction.type === "end-if";
              const isIfExpanded = isIf && expandedIfBlocks.has(instruction.id);
              const isLinkExpanded = expandedLinkInstructions.has(instruction.id);
              const isLoading = loadingLinkInstructions.has(instruction.id);
              const expandedInstructions = expandedLinkInstructions.get(instruction.id);

              // Hide instructions that are inside a collapsed IF block
              if (hiddenByIf.has(instruction.id)) {
                return null;
              }

              // Order number (excluding comments, IF and END-IF entries)
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
                      description={viewMode === "cards" ? instruction.description : undefined}
                      selected={selectedInstructionId === instruction.id}
                      onClick={(event) => handleInstructionClick(instruction.id, event)}
                      instructionType={"type" in instruction ? instruction.type : undefined}
                      explanation={"explanation" in instruction ? instruction.explanation : []}
                      className={`${styles.instructionListItem} ${viewMode === "list" ? styles.listModeItem : ""}`}
                      orderNumber={orderNumber}
                      isCompleted={completedInstructions.has(instruction.id)}
                    />
                    {isPreview && (
                      <button
                        className={styles.editInstructionButton}
                        onClick={() => navigate(`/admin/instructions?instructionId=${instruction.id}`)}
                        title={`Edit instruction ${instruction.id}`}
                      >
                        ✏️ Edit ^
                      </button>
                    )}
                    {"type" in instruction && instruction.type === "link" && "missionId" in instruction && (
                      <div style={{ marginLeft: "1rem", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
                        {isLoading ? "Loading..." : isLinkExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                    {selectedInstructionId === instruction.id &&
                      ("type" in instruction ? instruction.type !== "link" : true) &&
                      !isComment &&
                      "explanation" in instruction &&
                      Array.isArray(instruction.explanation) &&
                      instruction.explanation.length > 0 && (
                        <div className={styles.mobileExplanation}>
                          <ExplanationDisplay instruction={instruction as Instruction} />
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
                                <ExplanationDisplay instruction={linkedInstruction} />
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
          <ExplanationDisplay instruction={instructionToDisplay as Instruction | null} className={styles.explanationContainer} />
        </section>
      </div>
    </>
  );
}
