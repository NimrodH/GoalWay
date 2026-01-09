import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { instructionsHe, type Instruction, type InstructionContent } from "~/data/instructions-he";
import { missionsHe, type Mission } from "~/data/missions-he";
import { uploadImage } from "~/lib/image-upload";
import styles from "./admin.module.css";

// Component for individual explanation content items with image upload
function ExplanationContentItemHe({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: InstructionContent;
  index: number;
  onUpdate: (index: number, content: string) => void;
  onRemove: (index: number) => void;
}) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(item.type === "image" ? item.content : "");
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, 'instructions');
    setIsUploading(false);

    if ('error' in result) {
      alert(`העלאה נכשלה: ${result.error}`);
    } else {
      setImagePreview(result.url);
      onUpdate(index, result.url);
      alert('התמונה הועלתה בהצלחה!');
    }
  };

  return (
    <div className={styles.contentItem}>
      <div className={styles.contentItemHeader}>
        <span className={styles.contentItemType}>
          {item.type === "text" ? "טקסט" : item.type === "image" ? "תמונה" : "וידאו"}
        </span>
        <button
          className={styles.removeButton}
          onClick={() => onRemove(index)}
        >
          הסר
        </button>
      </div>
      
      {item.type === "text" ? (
        <textarea
          className={styles.textarea}
          value={item.content}
          onChange={(e) => onUpdate(index, e.target.value)}
          placeholder="הזן תוכן טקסט..."
        />
      ) : item.type === "image" ? (
        <div>
          <div className={styles.formGroup}>
            <label className={styles.label}>כתובת URL של תמונה</label>
            <input
              type="text"
              className={styles.input}
              value={item.content}
              onChange={(e) => onUpdate(index, e.target.value)}
              placeholder="הזן כתובת URL של תמונה או העלה למטה..."
            />
          </div>
          <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
            <label className={styles.label}>או העלה תמונה</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className={styles.input}
            />
            {imagePreview && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <img 
                  src={imagePreview} 
                  alt="תצוגה מקדימה" 
                  style={{ maxWidth: "200px", borderRadius: "var(--radius-2)" }}
                />
              </div>
            )}
            {imageFile && !isUploading && (
              <button
                type="button"
                onClick={handleImageUpload}
                className={styles.addButton}
                style={{ marginTop: "var(--space-2)" }}
              >
                העלה ל-Supabase
              </button>
            )}
            {isUploading && (
              <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>
                מעלה...
              </p>
            )}
          </div>
        </div>
      ) : item.type === "video" ? (
        <input
          type="text"
          className={styles.input}
          value={item.content}
          onChange={(e) => onUpdate(index, e.target.value)}
          placeholder="הזן כתובת URL של וידאו..."
        />
      ) : null}
    </div>
  );
}

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
          <ExplanationContentItemHe
            key={index}
            item={item}
            index={index}
            onUpdate={updateContent}
            onRemove={removeContent}
          />
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    setIsUploading(true);
    const result = await uploadImage(imageFile, 'missions');
    setIsUploading(false);

    if ('error' in result) {
      alert(`העלאה נכשלה: ${result.error}`);
    } else {
      setImagePreview(result.url);
      alert(`התמונה הועלתה בהצלחה! URL: ${result.url}`);
    }
  };

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
        <h2 className={styles.sectionTitle}>תמונת משימה (אופציונלי)</h2>
        <div className={styles.formGroup}>
          <label className={styles.label}>העלה תמונה</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className={styles.input}
          />
          {imagePreview && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <img 
                src={imagePreview} 
                alt="תצוגה מקדימה" 
                style={{ maxWidth: "300px", borderRadius: "var(--radius-3)" }}
              />
            </div>
          )}
          {imageFile && !isUploading && (
            <button
              type="button"
              onClick={handleImageUpload}
              className={styles.addButton}
              style={{ marginTop: "var(--space-3)" }}
            >
              העלה תמונה ל-Supabase
            </button>
          )}
          {isUploading && (
            <p style={{ marginTop: "var(--space-2)", color: "var(--color-accent-11)" }}>
              מעלה...
            </p>
          )}
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
