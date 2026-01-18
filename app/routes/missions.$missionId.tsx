import { useState } from "react";
import { data, Link, useNavigate, useLocation } from "react-router";
import type { Route } from "./+types/missions.$missionId";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen, ArrowLeft } from "lucide-react";
import styles from "./home.module.css";
import { getMissionById, getAllMissions } from "~/services/missions.server";
import { getInstructionsByIds } from "~/services/instructions.server";

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

export async function loader({ params }: Route.LoaderArgs) {
  const mission = await getMissionById(params.missionId);
  const allMissions = await getAllMissions();

  if (!mission) {
    throw data("Mission not found", { status: 404 });
  }

  const instructions = await getInstructionsByIds(mission.instructionIds);

  return { mission, instructions, allMissions };
}

export default function MissionPage({ loaderData }: Route.ComponentProps) {
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
      navigate(`/missions/${instruction.missionId}`, {
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
      navigate(`/missions/${previousMissionId}`);
    } else {
      navigate("/");
    }
  };

  const selectedInstruction = missionInstructions.find((inst) => inst?.id === selectedInstructionId) || null;

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
