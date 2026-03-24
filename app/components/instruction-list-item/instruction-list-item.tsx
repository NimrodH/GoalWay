import classNames from "classnames";
import { FileText, Link2, Image, Video } from "lucide-react";
import Markdown from "react-markdown";
import styles from "./instruction-list-item.module.css";

interface InstructionContent {
  type: "text" | "image" | "video";
  content: string;
}

interface InstructionListItemProps {
  /**
   * The title of the instruction to display
   * @important
   */
  title: string;
  /**
   * Optional description of the instruction
   */
  description?: string;
  /**
   * Whether this instruction is currently selected
   */
  selected: boolean;
  /**
   * Callback when the instruction is clicked
   */
  onClick: (event: React.MouseEvent) => void;
  className?: string;
  /**
   * Type of instruction (for link-type instructions)
   */
  instructionType?: "default" | "link";
  /**
   * Explanation content array to determine the type indicator
   */
  explanation?: InstructionContent[];
  /**
   * The order number of the instruction (1-indexed)
   */
  orderNumber?: number;
  /**
   * Whether this instruction has been completed
   */
  isCompleted?: boolean;
}

export function InstructionListItem({ 
  title, 
  description, 
  selected, 
  onClick, 
  className,
  instructionType,
  explanation = [],
  orderNumber,
  isCompleted = false
}: InstructionListItemProps) {
  
  // Determine which indicator to show
  const getIndicator = () => {
    // 1. Link type
    if (instructionType === "link") {
      return <Link2 className={styles.indicator} size={14} />;
    }
    
    // 2. No explanation
    if (explanation.length === 0) {
      return null; // No indicator
    }
    
    // 3. Check for media (image or video)
    const hasImage = explanation.some(item => item.type === "image");
    const hasVideo = explanation.some(item => item.type === "video");
    
    if (hasImage || hasVideo) {
      const Icon = hasVideo ? Video : Image;
      return <Icon className={styles.indicator} size={14} />;
    }
    
    // 4. Text-only explanation
    return <FileText className={styles.indicator} size={14} />;
  };
  
  const indicator = getIndicator();
  
  return (
    <div className={classNames(styles.item, { [styles.selected]: selected }, className)} onClick={(e) => onClick(e)}>
      <div className={styles.titleRow}>
        {orderNumber !== undefined && (
          <div className={classNames(styles.orderNumber, { 
            [styles.selectedNumber]: selected,
            [styles.completedNumber]: isCompleted && !selected
          })}>
            {orderNumber}
          </div>
        )}
        <div className={styles.title}>
          <div className={styles.titleMarkdown}>
            <Markdown>{title}</Markdown>
          </div>
        </div>
        {indicator}
      </div>
      {description && (
        <div className={styles.description}>
          <Markdown>{description}</Markdown>
        </div>
      )}
    </div>
  );
}
