import { useRef, useState } from "react";
import { drawioToMissionInstructions } from "~/lib/flowchart2goalway";
import styles from "./drawio-upload-dialog.module.css";

interface DrawioUploadDialogProps {
  onClose: () => void;
  /**
   * Called when the user confirms the import.
   * Receives the parsed instruction list ready to be spread into
   * `selectedInstructions`.
   */
  onImport: (instructions: Array<[string, string?]>) => void;
}

/** Dialog that lets the admin upload a draw.io XML file and converts it into mission instructions. */
export function DrawioUploadDialog({ onClose, onImport }: DrawioUploadDialogProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [linearPreview, setLinearPreview] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Array<[string, string?]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);
    setFileName(file.name);
    setParsed(null);
    setLinearPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const result = drawioToMissionInstructions(text);
        setParsed(result.instructions);
        setLinearPreview(result.linearText);
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
    onImport(parsed);
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

          {/* Stats */}
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

          {/* Linear preview */}
          {linearPreview && (
            <div className={styles.previewBox}>
              <p className={styles.previewLabel}>Preview</p>
              <pre className={styles.previewText}>{linearPreview}</pre>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.importBtn} onClick={handleImport} disabled={!parsed}>
            Import to Mission
          </button>
        </div>
      </div>
    </div>
  );
}
