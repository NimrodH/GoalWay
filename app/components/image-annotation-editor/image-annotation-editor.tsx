import { useState, useRef, useCallback } from "react";
import type { Annotation, BadgeSide } from "~/services/instructions.server";
import { ImageAnnotationView } from "~/components/image-annotation-view/image-annotation-view";
import styles from "./image-annotation-editor.module.css";

type DrawMode = "annotate" | "redact";

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

interface MoveState {
  id: string;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
  active: boolean;
}

const ANNOTATION_COLORS = [
  "#e5484d", // red
  "#0090ff", // blue
  "#30a46c", // green
  "#f76b15", // orange
  "#8e4ec6", // purple
  "#00a2c7", // cyan
  "#d4d4d4", // light gray (for redaction)
];

const COLOR_LABELS: Record<string, string> = {
  "#e5484d": "Red — Click",
  "#f76b15": "Orange — Double-click",
  "#0090ff": "Blue — Write",
  "#30a46c": "Green — Optional",
  "#8e4ec6": "Purple",
  "#00a2c7": "Cyan",
  "#d4d4d4": "Gray — Redaction",
};

/** Badge side options with their display labels */
const BADGE_SIDES: { value: BadgeSide; label: string }[] = [
  { value: "top-left",     label: "↖" },
  { value: "top-right",    label: "↗" },
  { value: "bottom-left",  label: "↙" },
  { value: "bottom-right", label: "↘" },
];

const MIN_SIZE_PCT = 2; // minimum 2% to avoid accidental tiny rects

function generateId() {
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ImageAnnotationEditorProps {
  src: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
  onClose: () => void;
}

/**
 * Ghost SVG overlay that uses the same viewBox as ImageAnnotationView
 * ("0 0 100 100" with preserveAspectRatio="none").
 * Coordinates are in %-of-image units — no scaling needed.
 */
function GhostRect({
  rect,
  color,
  className,
  isRedact = false,
}: {
  rect: { x: number; y: number; width: number; height: number };
  color: string;
  className?: string;
  isRedact?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {isRedact ? (
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill={color}
          fillOpacity={0.7}
          stroke={color === "#d4d4d4" ? "#888" : color}
          strokeWidth={0.4}
          strokeDasharray="2 1"
        />
      ) : (
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={0.5}
          strokeDasharray="2 1"
        />
      )}
    </svg>
  );
}

/**
 * Admin-only drag-to-draw annotation editor.
 * Click-drag on the image to draw a rectangle.
 *
 * Coordinate system: x, width are % of rendered image width;
 * y, height are % of rendered image height.
 * Matches the coordinate system used by ImageAnnotationView (viewBox 0 0 100 100).
 */
export function ImageAnnotationEditor({ src, annotations, onChange, onClose }: ImageAnnotationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [move, setMove] = useState<MoveState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>("annotate");

  /**
   * Convert a mouse event position to percentage coordinates relative to
   * the rendered <img> element. We always measure against imgRef so that
   * x% = "% of image width" and y% = "% of image height", matching the
   * coordinate system used by ImageAnnotationView.
   */
  const toPercent = useCallback((e: React.PointerEvent | React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore capture errors
    }
    const { x, y } = toPercent(e);
    
    if (editingId) {
      const ann = annotations.find(a => a.id === editingId);
      if (ann) {
        setMove({ id: ann.id, startX: x, startY: y, originalX: ann.x, originalY: ann.y, active: true });
        return;
      }
    }

    setDraw({ startX: x, startY: y, currentX: x, currentY: y, active: true });
    setSelectedId(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const { x, y } = toPercent(e);

    if (move?.active) {
      const dx = x - move.startX;
      const dy = y - move.startY;
      const ann = annotations.find(a => a.id === move.id);
      if (ann) {
        const newX = Math.max(0, Math.min(100 - ann.width, move.originalX + dx));
        const newY = Math.max(0, Math.min(100 - ann.height, move.originalY + dy));
        onChange(annotations.map(a => a.id === move.id ? { ...a, x: parseFloat(newX.toFixed(2)), y: parseFloat(newY.toFixed(2)) } : a));
      }
      return;
    }

    if (!draw?.active) return;
    setDraw((d) => d ? { ...d, currentX: x, currentY: y } : null);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    if (move?.active) {
      setMove(null);
      setEditingId(null);
      return;
    }

    if (!draw?.active) return;
    // Use the last tracked position from mouseMove to avoid a positional jump
    // that occurs when mouseUp/mouseLeave fires at a slightly different coordinate
    // than the final mouseMove (especially in production vs. dev iframe environments).
    const x = draw.currentX;
    const y = draw.currentY;
    const x1 = Math.min(draw.startX, x);
    const y1 = Math.min(draw.startY, y);
    const w = Math.abs(x - draw.startX);
    const h = Math.abs(y - draw.startY);

    if (w >= MIN_SIZE_PCT && h >= MIN_SIZE_PCT) {
      if (drawMode === "redact") {
        // Redaction blocks don't count toward annotation numbering
        const newAnn: Annotation = {
          id: generateId(),
          x: parseFloat(x1.toFixed(2)),
          y: parseFloat(y1.toFixed(2)),
          width: parseFloat(w.toFixed(2)),
          height: parseFloat(h.toFixed(2)),
          label: 0,       // unused for redactions
          color: selectedColor,
          isRedaction: true,
        };
        onChange([...annotations, newAnn]);
        setSelectedId(newAnn.id);
      } else {
        // Count only non-redaction annotations for the next label
        const nextLabel = annotations.filter((a) => !a.isRedaction).length + 1;
        const newAnn: Annotation = {
          id: generateId(),
          x: parseFloat(x1.toFixed(2)),
          y: parseFloat(y1.toFixed(2)),
          width: parseFloat(w.toFixed(2)),
          height: parseFloat(h.toFixed(2)),
          label: nextLabel,
          color: selectedColor,
          badgeSide: "top-left",
        };
        onChange([...annotations, newAnn]);
        setSelectedId(newAnn.id);
      }
    }
    setDraw(null);
  };

  const deleteAnnotation = (id: string) => {
    const remaining = annotations.filter((a) => a.id !== id);
    // Re-number only the regular (non-redaction) annotations to keep labels sequential
    let labelCounter = 1;
    const renumbered = remaining.map((a) =>
      a.isRedaction ? a : { ...a, label: labelCounter++ }
    );
    onChange(renumbered);
    if (selectedId === id) setSelectedId(null);
  };

  /** Move a regular (non-redaction) annotation up or down in the list and renumber. */
  const moveAnnotation = (id: string, direction: "up" | "down") => {
    const idx = annotations.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= annotations.length) return;
    const updated = [...annotations];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    // Renumber only regular annotations
    let labelCounter = 1;
    const renumbered = updated.map((a) => (a.isRedaction ? a : { ...a, label: labelCounter++ }));
    onChange(renumbered);
  };

  const updateAnnotationColor = (id: string, color: string) => {
    onChange(annotations.map((a) => (a.id === id ? { ...a, color } : a)));
  };

  const updateAnnotationBadgeSide = (id: string, badgeSide: BadgeSide) => {
    onChange(annotations.map((a) => (a.id === id ? { ...a, badgeSide } : a)));
  };

  const updateAnnotationText = (id: string, text: string) => {
    onChange(annotations.map((a) => (a.id === id ? { ...a, text } : a)));
  };

  // Ghost rect while drawing
  const ghostRect = draw && draw.active
    ? {
        x: Math.min(draw.startX, draw.currentX),
        y: Math.min(draw.startY, draw.currentY),
        width: Math.abs(draw.currentX - draw.startX),
        height: Math.abs(draw.currentY - draw.startY),
      }
    : null;

  return (
    <div className={styles.editorOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.editorPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.editorHeader}>
          <h2 className={styles.editorTitle}>Annotate Image</h2>
          <button className={styles.closeBtn} onClick={onClose} title="Close">✕</button>
        </div>

        <div className={styles.toolbar}>
          {/* Mode toggle */}
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${drawMode === "annotate" ? styles.modeBtnActive : ""}`}
              onClick={() => setDrawMode("annotate")}
              title="Draw numbered annotation rectangles"
            >
              ✏️ Annotate
            </button>
            <button
              className={`${styles.modeBtn} ${drawMode === "redact" ? styles.modeBtnRedactActive : ""}`}
              onClick={() => setDrawMode("redact")}
              title="Draw opaque gray redaction blocks (hides content, no badge/number)"
            >
              ▬ Redact
            </button>
          </div>

          {/* Color picker — always visible */}
          <span className={styles.toolbarLabel}>Color:</span>
          <div className={styles.colorPicker}>
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                className={`${styles.colorSwatch} ${selectedColor === c ? styles.colorSwatchActive : ""}`}
                style={{ background: c }}
                onClick={() => setSelectedColor(c)}
                title={COLOR_LABELS[c] ?? c}
              />
            ))}
          </div>

          <span className={styles.toolbarHint}>
            {editingId ? "Click & drag on the image to move the annotation" : "Click & drag on the image to draw"}
          </span>
        </div>

        <div className={styles.canvasArea}>
          {/* Drawn annotations (view-only layer) */}
          <div
            ref={containerRef}
            className={styles.imageContainer}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ cursor: editingId ? "move" : "crosshair", touchAction: "none" }}
          >
            <ImageAnnotationView
              src={src}
              annotations={annotations}
              captionVisible={false}
              wrapperRef={imageWrapperRef}
              imgRef={imgRef}
              ghostOverlay={
                ghostRect && ghostRect.width > 0 && ghostRect.height > 0 ? (
                  <GhostRect
                    rect={ghostRect}
                    color={selectedColor}
                    className={styles.ghostOverlay}
                    isRedact={drawMode === "redact"}
                  />
                ) : null
              }
            />
          </div>

          {/* Annotation list */}
          <div className={styles.annotationList}>
            <h3 className={styles.listTitle}>
              Annotations ({annotations.filter((a) => !a.isRedaction).length})
              {annotations.some((a) => a.isRedaction) && (
                <span className={styles.redactionCount}>
                  &nbsp;· {annotations.filter((a) => a.isRedaction).length} redaction{annotations.filter((a) => a.isRedaction).length !== 1 ? "s" : ""}
                </span>
              )}
            </h3>
            {annotations.length === 0 && (
              <p className={styles.listEmpty}>No annotations yet. Drag on the image to add one.</p>
            )}
            {annotations.map((ann) => {
              const isSelected = selectedId === ann.id;

              // ── Redaction row ────────────────────────────────────────────
              if (ann.isRedaction) {
                return (
                  <div
                    key={ann.id}
                    className={`${styles.annotationRow} ${styles.redactionRow} ${isSelected ? styles.redactionRowSelected : ""}`}
                    onClick={() => setSelectedId(isSelected ? null : ann.id)}
                  >
                    <div className={styles.annTopRow}>
                      <div
                        className={styles.redactionBadge}
                        style={{ background: ann.color || "#d4d4d4" }}
                        title={ann.color || "#d4d4d4"}
                      />
                      <div className={styles.annCoords}>
                        x:{ann.x.toFixed(1)}% y:{ann.y.toFixed(1)}%
                        &nbsp;{ann.width.toFixed(1)}×{ann.height.toFixed(1)}%
                      </div>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                        title="Delete redaction block"
                      >
                        ✕
                      </button>
                    </div>
                    {isSelected && (
                      <textarea
                        className={styles.annTextarea}
                        placeholder="Label text (shown on redaction block)…"
                        value={ann.text ?? ""}
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateAnnotationText(ann.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              }

              // ── Regular annotation row ───────────────────────────────────
              const annIdx = annotations.indexOf(ann);
              const canMoveUp = annIdx > 0;
              const canMoveDown = annIdx < annotations.length - 1;
              return (
                <div
                  key={ann.id}
                  className={`${styles.annotationRow} ${isSelected ? styles.annotationRowSelected : ""}`}
                  onClick={() => setSelectedId(isSelected ? null : ann.id)}
                >
                  {/* Top row: badge + coords + move + delete */}
                  <div className={styles.annTopRow}>
                    <div
                      className={styles.annBadge}
                      style={{ background: ann.color || "#e5484d" }}
                    >
                      {ann.label}
                    </div>
                    <div className={styles.annCoords}>
                      x:{ann.x.toFixed(1)}% y:{ann.y.toFixed(1)}%
                      &nbsp;{ann.width.toFixed(1)}×{ann.height.toFixed(1)}%
                    </div>
                    <button
                      className={`${styles.moveBtn} ${editingId === ann.id ? styles.moveBtnActive : ""}`}
                      onClick={(e) => { e.stopPropagation(); setEditingId(editingId === ann.id ? null : ann.id); }}
                      title="Move position on image"
                    >
                      ✥
                    </button>
                    <button
                      className={styles.moveBtn}
                      onClick={(e) => { e.stopPropagation(); moveAnnotation(ann.id, "up"); }}
                      disabled={!canMoveUp}
                      title="Move annotation up"
                    >
                      ↑
                    </button>
                    <button
                      className={styles.moveBtn}
                      onClick={(e) => { e.stopPropagation(); moveAnnotation(ann.id, "down"); }}
                      disabled={!canMoveDown}
                      title="Move annotation down"
                    >
                      ↓
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                      title="Delete annotation"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Controls + text field — only visible when this row is selected */}
                  {isSelected && (
                    <div className={styles.annControlsRow}>
                      <textarea
                        className={styles.annTextarea}
                        placeholder="Description (supports Markdown)…"
                        value={ann.text ?? ""}
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateAnnotationText(ann.id, e.target.value)}
                      />
                      <div className={styles.annControlsInline}>
                        <div className={styles.controlGroup}>
                          <span className={styles.controlLabel}>Color</span>
                          <div className={styles.colorPicker} style={{ gap: "var(--space-1)" }}>
                            {ANNOTATION_COLORS.map((c) => (
                              <button
                                key={c}
                                className={`${styles.colorSwatch} ${styles.colorSwatchSm} ${ann.color === c ? styles.colorSwatchActive : ""}`}
                                style={{ background: c }}
                                onClick={(e) => { e.stopPropagation(); updateAnnotationColor(ann.id, c); }}
                                title={c}
                              />
                            ))}
                          </div>
                        </div>

                        <div className={styles.controlGroup}>
                          <span className={styles.controlLabel}>Badge position</span>
                          <div className={styles.sidePicker}>
                            {BADGE_SIDES.map(({ value, label }) => (
                              <button
                                key={value}
                                className={`${styles.sideBtn} ${(ann.badgeSide ?? "top-left") === value ? styles.sideBtnActive : ""}`}
                                onClick={(e) => { e.stopPropagation(); updateAnnotationBadgeSide(ann.id, value); }}
                                title={value}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.editorFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.saveBtn}
            onClick={onClose}
          >
            ✓ Done
          </button>
        </div>
      </div>
    </div>
  );
}
