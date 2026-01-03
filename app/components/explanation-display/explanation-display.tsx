import type { Instruction, InstructionContent } from "~/data/instructions";
import styles from "./explanation-display.module.css";

interface ExplanationDisplayProps {
  /**
   * The instruction to display, or null if none selected
   */
  instruction?: Instruction | null;
  /**
   * Title to display (overrides instruction.title)
   */
  title?: string;
  /**
   * Explanation content to display (overrides instruction.explanation)
   */
  explanation?: InstructionContent[];
  className?: string;
}

export function ExplanationDisplay({ instruction, title, explanation, className }: ExplanationDisplayProps) {
  const displayTitle = title || instruction?.title;
  const displayExplanation = explanation || instruction?.explanation;

  if (!displayTitle || !displayExplanation) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Select an instruction from the list to view its detailed explanation</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className={styles.title}>{displayTitle}</h2>
      <div className={styles.content}>
        {displayExplanation.map((item: InstructionContent, index: number) => {
          if (item.type === "text") {
            return (
              <p key={index} className={styles.paragraph}>
                {item.content}
              </p>
            );
          }

          if (item.type === "image") {
            return (
              <img
                key={index}
                src={item.content}
                alt={`Illustration for ${displayTitle}`}
                className={styles.image}
              />
            );
          }

          if (item.type === "video") {
            return (
              <video key={index} controls className={styles.video}>
                <source src={item.content} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
