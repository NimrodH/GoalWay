import classNames from "classnames";
import styles from "./instruction-list-item.module.css";

interface InstructionListItemProps {
  /**
   * The title of the instruction to display
   * @important
   */
  title: string;
  /**
   * Whether this instruction is currently selected
   */
  selected: boolean;
  /**
   * Callback when the instruction is clicked
   */
  onClick: () => void;
  className?: string;
}

export function InstructionListItem({ title, selected, onClick, className }: InstructionListItemProps) {
  return (
    <div className={classNames(styles.item, { [styles.selected]: selected }, className)} onClick={onClick}>
      <h3 className={styles.title}>{title}</h3>
    </div>
  );
}
