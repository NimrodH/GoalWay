import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { instructions, type Instruction, type InstructionContent } from "~/data/instructions";
import { missions, type Mission } from "~/data/missions";
import styles from "./admin.module.css";

export default function AdminPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Developer Admin Panel</h1>
        <p className={styles.subtitle}>Create and manage instructions and missions</p>
      </header>

      <Tabs defaultValue="instruction" className={styles.tabs}>
        <TabsList>
          <TabsTrigger value="instruction">New Instruction</TabsTrigger>
          <TabsTrigger value="mission">New Mission</TabsTrigger>
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
        <h2 className={styles.sectionTitle}>Instruction Details</h2>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Instruction ID</label>
            <input
              type="text"
              className={styles.input}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g., 9"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Title</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Getting Started with Advanced Features"
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Explanation Content</h2>
        
        {explanation.map((item, index) => (
          <div key={index} className={styles.contentItem}>
            <div className={styles.contentItemHeader}>
              <span className={styles.contentItemType}>{item.type}</span>
              <button
                className={styles.removeButton}
                onClick={() => removeContent(index)}
              >
                Remove
              </button>
            </div>
            
            {item.type === "text" ? (
              <textarea
                className={styles.textarea}
                value={item.content}
                onChange={(e) => updateContent(index, e.target.value)}
                placeholder="Enter text content..."
              />
            ) : (
              <input
                type="text"
                className={styles.input}
                value={item.content}
                onChange={(e) => updateContent(index, e.target.value)}
                placeholder={`Enter ${item.type} URL...`}
              />
            )}
          </div>
        ))}

        <div className={styles.addContentButtons}>
          <button className={styles.addButton} onClick={() => addContent("text")}>
            + Add Text
          </button>
          <button className={styles.addButton} onClick={() => addContent("image")}>
            + Add Image
          </button>
          <button className={styles.addButton} onClick={() => addContent("video")}>
            + Add Video
          </button>
        </div>
      </div>

      <div className={styles.previewSection}>
        <h2 className={styles.previewTitle}>Generated Code</h2>
        <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
          Copy this object and add it to the <code>instructions</code> array in <code>app/data/instructions.ts</code>
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
        <h2 className={styles.sectionTitle}>Mission Details</h2>
        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Mission ID</label>
            <input
              type="text"
              className={styles.input}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g., security-basics"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Title</label>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Security Fundamentals"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter mission description..."
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h2 className={styles.sectionTitle}>Select Instructions</h2>
        <div className={styles.instructionCheckboxList}>
          {instructions.map((instruction) => (
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
        <h2 className={styles.previewTitle}>Generated Code</h2>
        <p style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--color-neutral-11)" }}>
          Copy this object and add it to the <code>missions</code> array in <code>app/data/missions.ts</code>
        </p>
        <pre className={styles.outputCode}>{generateCode()}</pre>
      </div>
    </div>
  );
}
