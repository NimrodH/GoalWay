import { useState } from "react";
import { data, Link, useNavigate, useLocation } from "react-router";
import type { Route } from "./+types/he.missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";
import styles from "./home.module.css";
import { getMissionByIdHe, getAllMissionsHe } from "~/services/missions.server";
import { getInstructionsByIdsHe } from "~/services/instructions.server";
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

export async function loader({ params }: Route.LoaderArgs) {
  const mission = await getMissionByIdHe(params.missionId);
  const allMissions = await getAllMissionsHe();
  
  if (!mission) {
    throw data("משימה לא נמצאה", { status: 404 });
  }

  const instructionIds = mission.instructions.map(([id]) => id);
  const instructions = await getInstructionsByIdsHe(instructionIds);

  return { mission, instructions, allMissions };
}

export default function HeMissionPage({ loaderData }: Route.ComponentProps) {
  const { mission, instructions, allMissions } = loaderData;

  // Map instructions to maintain order from mission.instructions and apply custom titles
  const missionInstructions = mission.instructions.map(([id, customTitle]) => {
    const instruction = instructions.find(inst => inst.id === id);
    if (!instruction) return null;
    return customTitle ? { ...instruction, title: customTitle } : instruction;
  }).filter(Boolean) as typeof instructions;

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  const [expandedLinkInstructions, setExpandedLinkInstructions] = useState<Map<string, Instruction[]>>(new Map());
  const [loadingLinkInstructions, setLoadingLinkInstructions] = useState<Set<string>>(new Set());

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
        // Fetch linked mission data (Hebrew version)
        const response = await fetch(`/api/he/missions/${linkedMissionId}`);
        if (!response.ok) {
          console.error('Failed to fetch linked mission');
          return;
        }
        
        const linkedMissionData = await response.json();
        const linkedMission = linkedMissionData.mission;
        const linkedInstructions = linkedMissionData.instructions;
        
        // Map linked mission instructions with custom titles
        const linkedMissionInstructions = linkedMission.instructions.map(([id, customTitle]: [string, string?]) => {
          const instruction = linkedInstructions.find((inst: Instruction) => inst.id === id);
          if (!instruction) return null;
          return customTitle ? { ...instruction, title: customTitle } : instruction;
        }).filter(Boolean) as Instruction[];
        
        // Add to expanded map
        const newMap = new Map(expandedLinkInstructions);
        newMap.set(instructionId, linkedMissionInstructions);
        setExpandedLinkInstructions(newMap);
      } catch (error) {
        console.error('Error fetching linked mission:', error);
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
      navigate(`/admin/instructions?instructionId=${instructionId}`);
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
    <div className={styles.container} dir="rtl">
      <section className={styles.instructionListSection}>
        <div className={styles.headerWrapper}>
          {previousMissionId && (
            <button onClick={handleBackClick} className={styles.menuLink}>
              <ArrowLeft size={18} />
              חזור למשימה הקודמת
            </button>
          )}
          <h1 className={styles.sectionHeader}>{mission.title}</h1>
          <Link to="/he" className={styles.menuLink}>
            <BookOpen size={18} />
            צפה בכל המשימות
          </Link>
        </div>
        <p className={styles.missionDescription}>{mission.description}</p>
        <div className={styles.instructionList}>
          {missionInstructions.map((instruction) => {
            const isExpanded = expandedLinkInstructions.has(instruction.id);
            const isLoading = loadingLinkInstructions.has(instruction.id);
            const expandedInstructions = expandedLinkInstructions.get(instruction.id);
            
            return (
              <div key={instruction.id}>
                <div className={styles.instructionItem}>
                  <InstructionListItem
                    title={instruction.title}
                    description={instruction.description}
                    selected={selectedInstructionId === instruction.id}
                    onClick={(event) => handleInstructionClick(instruction.id, event)}
                  />
                  {instruction.type === "link" && (
                    <div style={{ marginRight: '1rem', fontSize: '0.875rem', color: 'var(--color-neutral-11)' }}>
                      {isLoading ? "טוען..." : (isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                    </div>
                  )}
                  {selectedInstructionId === instruction.id && instruction.type !== "link" && (
                    <div className={styles.mobileExplanation}>
                      <ExplanationDisplay instruction={instruction} />
                    </div>
                  )}
                </div>
                
                {/* Render expanded linked mission instructions */}
                {isExpanded && expandedInstructions && (
                  <div style={{ marginRight: '2rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                    {expandedInstructions.map((linkedInstruction) => (
                      <div key={linkedInstruction.id} className={styles.instructionItem}>
                        <InstructionListItem
                          title={linkedInstruction.title}
                          description={linkedInstruction.description}
                          selected={selectedInstructionId === linkedInstruction.id}
                          onClick={(event) => {
                            // If Shift key is pressed, navigate to admin page
                            if (event?.shiftKey) {
                              navigate(`/admin/instructions?instructionId=${linkedInstruction.id}`);
                              return;
                            }
                            // Toggle selection
                            if (selectedInstructionId === linkedInstruction.id) {
                              setSelectedInstructionId(null);
                            } else {
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
        <ExplanationDisplay instruction={selectedInstruction} className={styles.explanationContainer} />
      </section>
    </div>
  );
}
