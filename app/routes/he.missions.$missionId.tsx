import { useState } from "react";
import { data, Link, useNavigate, useLocation } from "react-router";
import type { Route } from "./+types/he.missions.$missionId";
import { missionsHe } from "~/data/missions-he";
import { instructionsHe } from "~/data/instructions-he";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft } from "lucide-react";
import styles from "./home.module.css";

export function meta({ params }: Route.MetaArgs) {
  const mission = missionsHe.find((m) => m.id === params.missionId);
  return [
    { title: mission ? `${mission.title} - משימות` : "משימה לא נמצאה" },
    {
      name: "description",
      content: mission?.description || "פרטי משימה",
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const mission = missionsHe.find((m) => m.id === params.missionId);
  
  if (!mission) {
    throw data("משימה לא נמצאה", { status: 404 });
  }

  return { mission };
}

export default function HeMissionPage({ loaderData }: Route.ComponentProps) {
  const { mission } = loaderData;

  // Get instructions for this mission in the specified order
  const missionInstructions = mission.instructionIds
    .map((id) => instructionsHe.find((inst) => inst.id === id))
    .filter(Boolean);

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the previous mission from location state or default to home
  const previousMissionId = (location.state as { from?: string })?.from;

  const handleInstructionClick = (instructionId: string) => {
    const instruction = missionInstructions.find((inst) => inst?.id === instructionId);
    
    // If it's a link type instruction, navigate to the linked mission
    if (instruction?.type === "link" && instruction.missionId) {
      navigate(`/he/missions/${instruction.missionId}`, {
        state: { from: mission.id },
      });
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
            // For link type, get the mission title
            const displayTitle = instruction!.type === "link" && instruction!.missionId
              ? missionsHe.find((m) => m.id === instruction!.missionId)?.title || instruction!.title
              : instruction!.title;
            
            return (
              <div key={instruction!.id} className={styles.instructionItem}>
                <InstructionListItem
                  title={displayTitle}
                  selected={selectedInstructionId === instruction!.id}
                  onClick={() => handleInstructionClick(instruction!.id)}
                />
                {selectedInstructionId === instruction!.id && instruction!.type !== "link" && (
                  <div className={styles.mobileExplanation}>
                    <ExplanationDisplay instruction={instruction!} />
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
