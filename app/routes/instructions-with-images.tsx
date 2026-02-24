import type { Route } from "./+types/instructions-with-images";
import { instructions } from "~/data/instructions";
import styles from "./instructions-with-images.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Instructions with Images" },
    {
      name: "description",
      content: "Visual step-by-step instructions with images",
    },
  ];
}

export default function InstructionsWithImages() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Visual Instructions</h1>
          <p className={styles.subtitle}>
            Follow these step-by-step instructions to complete your task
          </p>
        </header>

        {/* Single picture at the top */}
        <div className={styles.imageContainer}>
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=600&fit=crop"
            alt="Instructions overview"
            className={styles.image}
          />
        </div>

        {/* List of instruction titles */}
        <div className={styles.instructionsList}>
          <h2 className={styles.sectionTitle}>Available Instructions</h2>
          <div className={styles.instructionCheckboxList}>
            {instructions.map((instruction) => (
              <div key={instruction.id} className={styles.instructionItem}>
                <span className={styles.instructionId}>{instruction.id}</span>
                <span className={styles.instructionTitle}>{instruction.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
