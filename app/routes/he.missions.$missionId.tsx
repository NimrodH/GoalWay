import { useState } from "react";
import { data, Link, useNavigate, useLocation } from "react-router";
import type { Route } from "./+types/he.missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft } from "lucide-react";
import styles from "./home.module.css";
import { getMissionByIdHe, getAllMissionsHe } from "~/services/missions.server";
import { getInstructionsByIdsHe } from "~/services/instructions.server";

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

  const instructions = await getInstructionsByIdsHe(mission.instructionIds);

  return { mission, instructions, allMissions };
}

export default function HeMissionPage({ loaderData }: Route.ComponentProps) {
  const { mission, instructions, allMissions } = loaderData;

  const missionInstructions = instructions;

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the previous mission from location state or default to home
  const previousMissionId = (location.state as { from?: string })?.from;

  const handleInstructionClick = (instructionId: string, event?: React.MouseEvent) => {
    const instruction = missionInstructions.find((inst) => inst?.id === instructionId);
    
    // If Shift key is pressed, navigate to admin page with instruction selected
    if (event?.shiftKey) {
      navigate(`/admin?tab=instructions&instructionId=${instructionId}`);
      return;
    }
    
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
            const displayTitle = mission.instructionTitles?.[instruction.id] || instruction.title;
            return (
              <div key={instruction.id} className={styles.instructionItem}>
                <InstructionListItem
                  title={displayTitle}
                  description={instruction.description}
                  selected={selectedInstructionId === instruction.id}
                  onClick={(event) => handleInstructionClick(instruction.id, event)}
                />
                {selectedInstructionId === instruction.id && instruction.type !== "link" && (
                  <div className={styles.mobileExplanation}>
                    <ExplanationDisplay instruction={instruction} />
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
