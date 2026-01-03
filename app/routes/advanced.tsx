import { useState } from "react";
import type { Route } from "./+types/advanced";
import { instructions, type Instruction } from "~/data/instructions";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import styles from "./home.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Advanced Instructions - Profile & Analytics" },
    {
      name: "description",
      content:
        "Learn about configuring your profile settings and understanding analytics and reports.",
    },
  ];
}

export default function Advanced() {
  // Filter to get only instructions with id "2" and "5"
  const filteredInstructions = instructions.filter(
    (instruction) => instruction.id === "2" || instruction.id === "5"
  );

  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);

  const handleInstructionClick = (instructionId: string) => {
    // Toggle: if clicking the same instruction, deselect it
    if (selectedInstructionId === instructionId) {
      setSelectedInstructionId(null);
    } else {
      // Switch: select the new instruction
      setSelectedInstructionId(instructionId);
    }
  };

  const selectedInstruction = filteredInstructions.find((inst) => inst.id === selectedInstructionId) || null;

  return (
    <div className={styles.container}>
      <section className={styles.instructionListSection}>
        <h1 className={styles.sectionHeader}>Advanced Instructions</h1>
        <div className={styles.instructionList}>
          {filteredInstructions.map((instruction: Instruction) => (
            <div key={instruction.id} className={styles.instructionItem}>
              <InstructionListItem
                title={instruction.title}
                selected={selectedInstructionId === instruction.id}
                onClick={() => handleInstructionClick(instruction.id)}
              />
              {selectedInstructionId === instruction.id && (
                <div className={styles.mobileExplanation}>
                  <ExplanationDisplay instruction={instruction} />
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
