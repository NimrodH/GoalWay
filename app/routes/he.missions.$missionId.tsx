import { useState } from "react";
import { data, Link, useNavigate, useLocation } from "react-router";
import type { Route } from "./+types/he.missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft, ChevronUp, ChevronDown, GitBranch } from "lucide-react";
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

  // Strip duplicate-occurrence suffixes (#2, #3, …) and de-duplicate before querying the DB.
  const rawIds = mission.instructions.map(([id]) => id);
  const uniqueBaseIds = [...new Set(rawIds.map((id) => (id.includes("#") ? id.split("#")[0] : id)))];
  const instructions = await getInstructionsByIdsHe(uniqueBaseIds);

  return { mission, instructions, allMissions };
}

export default function HeMissionPage({ loaderData }: Route.ComponentProps) {
  const { mission, instructions, allMissions } = loaderData;

  // Map instructions to maintain order from mission.instructions and apply custom titles
  // IF entries are special conditional blocks; END-IF is hidden from end user
  const missionInstructions = mission.instructions.map(([id, customTitle]) => {
    if (id.startsWith("comment-") || id === "0") {
      return { id, title: customTitle || "", description: "", status: "comment" as const, type: "comment" as const, explanation: [] as [] };
    }
    if (id.startsWith("if-")) {
      return { id, title: customTitle || "IF", description: "", status: "if" as const, type: "if" as const, explanation: [] as [] };
    }
    if (id.startsWith("end-if-")) return null;
    // Strip the duplicate-occurrence suffix (#2, #3, …) for DB lookup,
    // but keep the full entry key as `id` for independent selection state.
    const baseId = id.includes("#") ? id.split("#")[0] : id;
    const instruction = instructions.find(inst => inst.id === baseId);
    if (!instruction) return null;
    const resolved = customTitle ? { ...instruction, title: customTitle } : instruction;
    return id !== baseId ? { ...resolved, id } : resolved;
  }).filter(Boolean) as (typeof instructions[number] | { id: string; title: string; description: string; status: "comment"; type: "comment"; explanation: [] } | { id: string; title: string; description: string; status: "if"; type: "if"; explanation: [] })[];

  // Build map: ifId -> array of raw instruction IDs inside the block
  const ifBlockMap = (() => {
    const map = new Map<string, string[]>();
    let currentIfId: string | null = null;
    const inside: string[] = [];
    for (const [id] of mission.instructions) {
      if (id.startsWith("if-")) {
        currentIfId = id;
      } else if (id.startsWith("end-if-")) {
        if (currentIfId) { map.set(currentIfId, [...inside]); inside.length = 0; currentIfId = null; }
      } else if (currentIfId) {
        inside.push(id);
      }
    }
    if (currentIfId) map.set(currentIfId, [...inside]);
    return map;
  })();

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  const [expandedIfBlocks, setExpandedIfBlocks] = useState<Set<string>>(new Set());

  const toggleIfBlock = (ifId: string) => {
    setExpandedIfBlocks(prev => {
      const next = new Set(prev);
      if (next.has(ifId)) next.delete(ifId); else next.add(ifId);
      return next;
    });
  };

  const hiddenByIf = new Set<string>();
  for (const [ifId, ids] of ifBlockMap) {
    if (!expandedIfBlocks.has(ifId)) { for (const id of ids) hiddenByIf.add(id); }
  }
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
            if (hiddenByIf.has(instruction.id)) return null;

            const isComment = "type" in instruction && instruction.type === "comment";
            const isIf = "type" in instruction && instruction.type === "if";
            const isIfExpanded = isIf && expandedIfBlocks.has(instruction.id);
            const isLinkExpanded = expandedLinkInstructions.has(instruction.id);
            const isLoading = loadingLinkInstructions.has(instruction.id);
            const expandedInstructions = expandedLinkInstructions.get(instruction.id);

            if (isComment) {
              return (
                <div key={instruction.id} className={styles.instructionItem}>
                  <div style={{ display: "flex", alignItems: "center", padding: "var(--space-3) var(--space-4)", color: "var(--color-accent-11)", fontStyle: "italic", fontSize: "0.9rem", opacity: 0.8 }}>
                    <span style={{ marginLeft: "var(--space-2)", flexShrink: 0 }}>💬</span>
                    {instruction.title}
                  </div>
                </div>
              );
            }

            if (isIf) {
              return (
                <div key={instruction.id} className={styles.instructionItem}>
                  <button
                    onClick={() => toggleIfBlock(instruction.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      width: "100%", padding: "var(--space-3) var(--space-4)",
                      background: isIfExpanded ? "var(--color-success-4)" : "var(--color-success-3)",
                      border: `1px solid ${isIfExpanded ? "var(--color-success-8)" : "var(--color-success-7)"}`,
                      borderRadius: "var(--radius-2)", color: "var(--color-success-11)",
                      fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 600,
                      cursor: "pointer", textAlign: "right", marginBottom: "var(--space-1)",
                    }}
                    aria-expanded={isIfExpanded}
                  >
                    <GitBranch size={18} style={{ flexShrink: 0, color: "var(--color-success-9)" }} />
                    <span style={{ flex: 1 }}>{instruction.title}</span>
                    {isIfExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              );
            }
            
            return (
              <div key={instruction.id}>
                <div className={styles.instructionItem}>
                  <InstructionListItem
                    title={instruction.title}
                    description={instruction.description}
                    selected={selectedInstructionId === instruction.id}
                    onClick={(event) => handleInstructionClick(instruction.id, event)}
                  />
                  {"type" in instruction && instruction.type === "link" && (
                    <div style={{ marginRight: '1rem', fontSize: '0.875rem', color: 'var(--color-neutral-11)' }}>
                      {isLoading ? "טוען..." : (isLinkExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                    </div>
                  )}
                  {selectedInstructionId === instruction.id && (
                    <div className={styles.mobileExplanation}>
                      <ExplanationDisplay instruction={instruction as Instruction} />
                    </div>
                  )}
                </div>
                
                {isLinkExpanded && expandedInstructions && (
                  <div style={{ marginRight: '2rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                    {expandedInstructions.map((linkedInstruction) => (
                      <div key={linkedInstruction.id} className={styles.instructionItem}>
                        <InstructionListItem
                          title={linkedInstruction.title}
                          description={linkedInstruction.description}
                          selected={selectedInstructionId === linkedInstruction.id}
                          onClick={(event) => {
                            if (event?.shiftKey) {
                              navigate(`/admin/instructions?instructionId=${linkedInstruction.id}`);
                              return;
                            }
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
        <ExplanationDisplay
          instruction={
            selectedInstruction &&
            "status" in selectedInstruction &&
            (selectedInstruction.status === "comment" || selectedInstruction.status === "if")
              ? null
              : (selectedInstruction as Instruction | null)
          }
          className={styles.explanationContainer}
        />
      </section>
    </div>
  );
}
