import { Link } from "react-router";
import { BookOpen, ArrowLeft } from "lucide-react";
import { instructions } from "~/data/instructions";
import styles from "./instructions.module.css";

export default function InstructionsMenu() {
  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Instructions & Guides</h1>
        <p className={styles.description}>
          Welcome to our comprehensive instruction center. Here you'll find detailed guides to help you make the most 
          of our platform. Each guide includes step-by-step instructions, visual aids, and best practices. Select any 
          instruction below to begin learning, and feel free to revisit these guides whenever you need assistance.
        </p>
      </header>

      <div className={styles.grid}>
        {instructions.map((instruction, index) => (
          <Link 
            key={instruction.id} 
            to={`/instructions/${instruction.id}`}
            className={styles.card}
          >
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}>
                <BookOpen size={24} />
              </div>
              <span className={styles.cardNumber}>Step {index + 1}</span>
            </div>
            <h2 className={styles.cardTitle}>{instruction.title}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
