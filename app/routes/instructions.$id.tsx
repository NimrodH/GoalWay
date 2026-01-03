import { Link, useParams } from "react-router";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { instructions } from "~/data/instructions";
import { ExplanationDisplay } from "~/components/explanation-display/explanation-display";
import styles from "./instructions.module.css";

export default function InstructionDetail() {
  const params = useParams();
  const instruction = instructions.find((inst) => inst.id === params.id);

  if (!instruction) {
    return (
      <div className={styles.container}>
        <Link to="/instructions" className={styles.backLink}>
          <ArrowLeft size={16} />
          Back to Instructions
        </Link>
        <div style={{ 
          textAlign: "center", 
          padding: "var(--space-9)", 
          color: "var(--color-error-11)" 
        }}>
          <AlertCircle size={48} style={{ marginBottom: "var(--space-4)" }} />
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem" }}>
            Instruction Not Found
          </h2>
          <p style={{ marginTop: "var(--space-3)", color: "var(--color-neutral-11)" }}>
            The instruction you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link to="/instructions" className={styles.backLink}>
        <ArrowLeft size={16} />
        Back to Instructions
      </Link>
      
      <ExplanationDisplay 
        title={instruction.title}
        explanation={instruction.explanation}
      />
    </div>
  );
}
