import { useEffect, useRef, useState } from "react";
import { drawioToMissionInstructions } from "~/lib/flowchart2goalway";
import styles from "./drawio-upload-dialog.module.css";

/**
 * Parse a human-readable linear preview text back into mission instruction
 * tuples. Inverse of the linearText output produced by drawioToMissionInstructions.
 *
 * Recognised syntax (same as the generated preview):
 *   START           — begin content (required)
 *   IF <condition>  — open an IF block
 *   ELSE            — else branch of the enclosing IF block
 *   END IF          — close the innermost IF block
 *   END             — stop parsing
 *   -- <text>       — ignored comment / cycle-detection note
 *   <any other non-empty line> — treated as a temp instruction (T1, T2, …)
 */
function parseLinearTextToInstructions(text: string): Array<[string, string?]> {
  const lines = text.split("\n");
  const instructions: Array<[string, string?]> = [];
  let tempCounter = 1;
  const ifStack: string[] = [];
  let inContent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === "START") { inContent = true; continue; }
    if (line === "END") break;
    if (!inContent) continue;

    if (line.startsWith("IF ")) {
      const conditionText = line.slice(3).trim();
      const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      ifStack.push(suffix);
      instructions.push([`if-${suffix}`, conditionText]);
    } else if (line === "ELSE") {
      const suffix = ifStack[ifStack.length - 1];
      if (suffix) instructions.push([`else-${suffix}`]);
    } else if (line === "END IF") {
      const suffix = ifStack.pop();
      if (suffix) instructions.push([`end-if-${suffix}`]);
    } else if (!line.startsWith("--")) {
      // Regular step — becomes a temporary instruction placeholder
      instructions.push([`T${tempCounter++}`, line]);
    }
  }

  // Safety: close any IF blocks the user forgot to close
  while (ifStack.length > 0) {
    const suffix = ifStack.pop()!;
    instructions.push([`end-if-${suffix}`]);
  }

  return instructions;
}

interface DrawioUploadDialogProps {
  onClose: () => void;
  /**
   * Called when the user confirms the import.
   * Receives the parsed instruction list ready to be spread into
   * `selectedInstructions`.
   */
  onImport: (instructions: Array<[string, string?]>, fileName: string) => void;
}

/** Dialog that lets the admin upload a draw.io XML file and converts it into mission instructions. */
export function DrawioUploadDialog({ onClose, onImport }: DrawioUploadDialogProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  /** Editable text representation of the instruction list. Editing it re-parses on the fly. */
  const [editedPreview, setEditedPreview] = useState<string>("");
  const [parsed, setParsed] = useState<Array<[string, string?]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-parse `parsed` from the editable text on every change so that stats
  // and the final import both reflect the user's edits.
  useEffect(() => {
    if (!editedPreview) {
      setParsed(null);
      return;
    }
    const result = parseLinearTextToInstructions(editedPreview);
    setParsed(result.length > 0 ? result : null);
  }, [editedPreview]);

  const processFile = (file: File) => {
    setError(null);
    setFileName(file.name);
    setParsed(null);
    setEditedPreview("");

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const result = drawioToMissionInstructions(text);
        // Setting editedPreview triggers the useEffect which updates `parsed`.
        setEditedPreview(result.linearText);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse draw.io file.");
      }
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    if (!parsed) return;
    onImport(parsed, fileName ?? "");
    onClose();
  };

  const instructionCount = parsed
    ? parsed.filter(([id]) => !id.startsWith("if-") && !id.startsWith("end-if-")).length
    : 0;
  const ifCount = parsed ? parsed.filter(([id]) => id.startsWith("if-")).length : 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>📊 Import from draw.io Flowchart</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* Drop zone */}
          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".drawio,.xml,.dio"
              className={styles.hiddenInput}
              onChange={handleFileChange}
              onClick={(e) => e.stopPropagation()}
            />
            <span className={styles.dropZoneIcon}>📂</span>
            <p className={styles.dropZoneText}>
              {fileName ? `File loaded: ${fileName}` : "Drop a draw.io file here, or click to browse"}
            </p>
            <p className={styles.dropZoneHint}>Supported: .drawio, .xml, .dio — plain or compressed</p>
          </div>

          {/* Error */}
          {error && <div className={styles.errorBox}>⚠️ {error}</div>}

          {/* Live stats — update as the user edits the preview */}
          {parsed && (
            <div className={styles.instructionCount}>
              ✅ Parsed <strong>{instructionCount}</strong> step{instructionCount !== 1 ? "s" : ""}
              {ifCount > 0 && (
                <>
                  {" + "}
                  <strong>{ifCount}</strong> IF branch{ifCount !== 1 ? "es" : ""}
                </>
              )}
            </div>
          )}

          {/* Editable preview — every keystroke re-parses the instruction list */}
          {editedPreview && (
            <div className={styles.previewBox}>
              <p className={styles.previewLabel}>
                Preview
                <span className={styles.previewHint}>
                  Edit to adjust steps · use IF / ELSE / END IF for branches
                </span>
              </p>
              <textarea
                className={styles.previewTextarea}
                value={editedPreview}
                onChange={(e) => setEditedPreview(e.target.value)}
                spellCheck={false}
                aria-label="Editable instruction preview"
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.importBtn} onClick={handleImport} disabled={!parsed}>
            Create New Mission
          </button>
        </div>
      </div>
    </div>
  );
}
