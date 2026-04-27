import type { Instruction, InstructionContent } from "~/data/instructions";
import styles from "./explanation-display.module.css";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { ImageAnnotationView } from "~/components/image-annotation-view/image-annotation-view";

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
  /** Controls visibility of annotation caption lists in embedded images */
  captionVisible?: boolean;
}

export function ExplanationDisplay({ instruction, title, explanation, className, captionVisible = true }: ExplanationDisplayProps) {
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
      <div className={styles.content}>
        {displayExplanation.map((item: InstructionContent, index: number) => {
          if (item.type === "text") {
            return (
              <div key={index} className={styles.markdown}>
                <Markdown remarkPlugins={[remarkBreaks]}>{item.content}</Markdown>
              </div>
            );
          }

          if (item.type === "image") {
            return (
              <ImageAnnotationView
                key={index}
                src={item.content}
                alt={`Illustration for ${displayTitle}`}
                annotations={item.annotations ?? []}
                captionVisible={captionVisible}
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
