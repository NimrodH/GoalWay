import { useState, useRef, useCallback } from "react";
import { useFetcher } from "react-router";
import { StickyNote, X, Pencil, Trash2, Check } from "lucide-react";
import styles from "./admin-notes-panel.module.css";

interface AdminNotesPanelProps {
  missionId: string;
  missionTitle?: string;
  initialNotes: string[];
}

export function AdminNotesPanel({ missionId, missionTitle, initialNotes }: AdminNotesPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<string[]>(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const fetcher = useFetcher<{ success: boolean; error?: string }>();

  const saveNotes = useCallback((updatedNotes: string[]) => {
    const fd = new FormData();
    fd.set("actionType", "updateAdminNotes");
    fd.set("missionId", missionId);
    fd.set("notes", JSON.stringify(updatedNotes));
    fetcher.submit(fd, { method: "post" });
  }, [fetcher, missionId]);

  const handleAddNote = () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    const updated = [...notes, trimmed];
    setNotes(updated);
    setNewNote("");
    saveNotes(updated);
  };

  const handleDeleteNote = (index: number) => {
    const updated = notes.filter((_, i) => i !== index);
    setNotes(updated);
    saveNotes(updated);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingText(notes[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;
    const updated = notes.map((n, i) => (i === editingIndex ? trimmed : n));
    setNotes(updated);
    setEditingIndex(null);
    setEditingText("");
    saveNotes(updated);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingText("");
  };

  const isSaving = fetcher.state !== "idle";
  const lastSaved = fetcher.state === "idle" && fetcher.data?.success === true;

  return (
    <>
      {/* Floating trigger */}
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(true)}
        title="View and edit admin notes for this mission"
        aria-label="Admin Notes"
      >
        <StickyNote size={14} />
        Admin Notes
        {notes.length > 0 && (
          <span className={styles.triggerBadge}>{notes.length}</span>
        )}
      </button>

      {/* Panel overlay */}
      {isOpen && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Admin Notes">
            {/* Header */}
            <div className={styles.panelHeader}>
              <StickyNote size={16} style={{ flexShrink: 0, color: "var(--color-accent-9)" }} />
              <h2 className={styles.panelTitle}>
                Admin Notes{" "}
                <span className={styles.missionId}>— Mission {missionId}{missionTitle ? `: ${missionTitle}` : ""}</span>
              </h2>
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close admin notes panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Notes list */}
            <div className={styles.notesList}>
              {notes.length === 0 && (
                <p className={styles.emptyState}>No admin notes yet. Add one below.</p>
              )}
              {notes.map((note, idx) => (
                <div
                  key={idx}
                  className={`${styles.noteItem} ${editingIndex === idx ? styles.editing : ""}`}
                >
                  {editingIndex === idx ? (
                    <div className={styles.editArea}>
                      <textarea
                        className={styles.editTextarea}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleSaveEdit();
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                      />
                      <div className={styles.editButtons}>
                        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCancelEdit}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={handleSaveEdit}
                          disabled={!editingText.trim()}
                        >
                          <Check size={12} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={styles.noteIcon}>☐</span>
                      <span className={styles.noteText}>{note}</span>
                      <div className={styles.noteActions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => handleStartEdit(idx)}
                          title="Edit note"
                          aria-label="Edit note"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.destructive}`}
                          onClick={() => handleDeleteNote(idx)}
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add note footer */}
            <div className={styles.panelFooter}>
              <textarea
                className={styles.addTextarea}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a new admin note… (Ctrl+Enter to save)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <div className={styles.footerRow}>
                <span>
                  {isSaving && <span className={styles.savingIndicator}>Saving…</span>}
                  {!isSaving && lastSaved && <span className={styles.savedIndicator}>✓ Saved</span>}
                </span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isSaving}
                >
                  + Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
