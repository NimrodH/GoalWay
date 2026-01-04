import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { instructionsHe, type Instruction, type InstructionContent } from "~/data/instructions-he";
import { missionsHe, type Mission } from "~/data/missions-he";
import styles from "./admin.module.css";

export default function HeAdminPage() {
  return (
    <div className={styles.container} dir="rtl">
      <header className={styles.header}>
        <h1 className={styles.title}>פאנל ניהול למפתחים</h1>
        <p className={styles.subtitle}>צור ונהל הוראות ומשימות</p>
      </header>

      <Tabs defaultValue="instruction" className={styles.tabs}>
        <TabsList>
          <TabsTrigger value="instruction">הוראה חדשה</TabsTrigger>
          <TabsTrigger value="mission">משימה חדשה</TabsTrigger>
        </TabsList>

        <TabsContent value="instruction">
          <InstructionForm />
        </TabsContent>

        <TabsContent value="mission">
          <MissionForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstructionForm() {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [explanation, setExplanation] = useState<InstructionContent[]>([]);

  const addContent = (type: "text" | "image" | "video") => {
    setExplanation([...explanation, { type, content: "" }]);
  };

  const updateContent = (index: number, content: string) => {
    const updated = [...explanation];
    updated[index].content = content;
    setExplanation(updated);
  };

  const removeContent = (index: number) => {
    setExplanation(explanation.filter((_, i) => i !== index));
  };

  const generateCode = () => {
    const instruction: Instruction = {
      id,
      title,
      explanation,
    };

    return JSON.stringify(instruction, null, 2);
  };

  return (
    <div>
      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>פרטי ההוראה</h2>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>מזהה הוראה</label>
            <input
              type="text"
              className={styles.input}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="לדוגמה: 9"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>כותרת</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: תחילת העבודה עם תכונות מתקדמות"
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>תוכן ההסבר</h2>
        
        {explanation.map((item, index) => (
          <div key={index} className={styles.contentItem}>
            <div className={styles.contentItemHeader}>
              <span className={styles.contentItemType}>{item.type === "text" ? "טקסט" : item.type === "image" ? "תמונה" : "וידאו"}</span>
              <button
                className={styles.removeButton}
                onClick={() => removeContent(index)}
              >
                הסר
              </button>
            </div>
            
            {item.type === "text" ? (
              <textarea
                className={styles.textarea}
                value={item.content}
                onChange={(e) => updateContent(index, e.target.value)}
                placeholder="הזן תוכן טקסט..."
              />
            ) : (
              <input
                type="text"
                className={styles.input}
                value={item.content}
                onChange={(e) => updateContent(index, e.target.value)}
                placeholder={`הזן כתובת URL של ${item.type === "image" ? "תמונה" : "וידאו"}...`}
              />
            )}
          </div>
        ))}

        <div className={styles.addContentButtons}>
          <button className={styles.addButton} onClick={() => addContent("text")}>
            + הוסף טקסט
          </button>
          <button className={styles.addButton} onClick={() => addContent("image")}>
            + הוסף תמונה
          </button>
          <button className={styles.addButton} onClick={() => addContent("video")}>
            + הוסף וידאו
          </button>
        </div>
      </div>

      <div className={styles.previewSection}>
        <h2 className={styles.previewTitle}>קוד שנוצר</h2>
        <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
          העתק את האובייקט הזה והוסף אותו למערך <code>instructionsHe</code> ב-<code>app/data/instructions-he.ts</code>
        </p>
        <pre className={styles.outputCode}>{generateCode()}</pre>
      </div>
    </div>
  );
}

function MissionForm() {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);

  const toggleInstruction = (instructionId: string) => {
    if (selectedInstructions.includes(instructionId)) {
      setSelectedInstructions(selectedInstructions.filter((id) => id !== instructionId));
    } else {
      setSelectedInstructions([...selectedInstructions, instructionId]);
    }
  };

  const generateCode = () => {
    const mission: Mission = {
      id,
      title,
      description,
      instructionIds: selectedInstructions,
    };

    return JSON.stringify(mission, null, 2);
  };

  return (
    <div>
      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>פרטי המשימה</h2>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>מזהה משימה</label>
            <input
              type="text"
              className={styles.input}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="לדוגמה: security-basics"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>כותרת</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: יסודות אבטחה"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>תיאור</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="הזן תיאור משימה..."
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>בחר הוראות</h2>
        <div className={styles.instructionCheckboxList}>
          {instructionsHe.map((instruction) => (
            <label key={instruction.id} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedInstructions.includes(instruction.id)}
                onChange={() => toggleInstruction(instruction.id)}
              />
              <span>
                {instruction.id} - {instruction.title}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.previewSection}>
        <h2 className={styles.previewTitle}>קוד שנוצר</h2>
        <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
          העתק את האובייקט הזה והוסף אותו למערך <code>missionsHe</code> ב-<code>app/data/missions-he.ts</code>
        </p>
        <pre className={styles.outputCode}>{generateCode()}</pre>
      </div>
    </div>
  );
}
