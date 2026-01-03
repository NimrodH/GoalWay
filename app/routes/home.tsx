import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { instructions, type Instruction } from "~/data/instructions";
import { InstructionListItem } from "~/components/instruction-list-item/instruction-list-item";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import { BookOpen } from "lucide-react";
import styles from "./home.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Instruction Guide - Clear Step-by-Step Guidance" },
    {
      name: "description",
      content:
        "Browse and explore detailed instructions with text, images, and videos to guide you through every step.",
    },
  ];
}

export default function Home() {
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

  const selectedInstruction = instructions.find((inst) => inst.id === selectedInstructionId) || null;

  return (
    <div className={styles.container}>
      <section className={styles.instructionListSection}>
        <div className={styles.headerWrapper}>
          <h1 className={styles.sectionHeader}>Instructions</h1>
          <Link to="/instructions" className={styles.menuLink}>
            <BookOpen size={18} />
            View All Instructions
          </Link>
        </div>
        <div className={styles.instructionList}>
          {instructions.map((instruction: Instruction) => (
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
