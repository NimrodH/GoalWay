import { useState } from "react";
import { data } from "react-router";
import type { Route } from "./+types/missions.$missionId";
import { missions } from "~/data/missions";
import { instructions } from "~/data/instructions";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import styles from "./home.module.css";

export function meta({ params }: Route.MetaArgs) {
  const mission = missions.find((m) => m.id === params.missionId);
  return [
    { title: mission ? `${mission.title} - Missions` : "Mission Not Found" },
    {
      name: "description",
      content: mission?.description || "Mission details",
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const mission = missions.find((m) => m.id === params.missionId);
  
  if (!mission) {
    throw data("Mission not found", { status: 404 });
  }

  return { mission };
}

export default function MissionPage({ loaderData }: Route.ComponentProps) {
  const { mission } = loaderData;

  // Get instructions for this mission in the specified order
  const missionInstructions = mission.instructionIds
    .map((id) => instructions.find((inst) => inst.id === id))
    .filter(Boolean);

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);

  const handleInstructionClick = (instructionId: string) => {
    if (selectedInstructionId === instructionId) {
      setSelectedInstructionId(null);
    } else {
      setSelectedInstructionId(instructionId);
    }
  };

  const selectedInstruction = missionInstructions.find((inst) => inst?.id === selectedInstructionId) || null;

  return (
    <div className={styles.container}>
      <section className={styles.instructionListSection}>
        <h1 className={styles.sectionHeader}>{mission.title}</h1>
        <p className={styles.missionDescription}>{mission.description}</p>
        <div className={styles.instructionList}>
          {missionInstructions.map((instruction) => (
            <div key={instruction!.id} className={styles.instructionItem}>
              <InstructionListItem
                title={instruction!.title}
                selected={selectedInstructionId === instruction!.id}
                onClick={() => handleInstructionClick(instruction!.id)}
              />
              {selectedInstructionId === instruction!.id && (
                <div className={styles.mobileExplanation}>
                  <ExplanationDisplay instruction={instruction!} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.explanationSection}>
        <ExplanationDisplay instruction={selectedInstruction} className={styles.explanationContainer} />
      </section>
    </div>
  );
}
