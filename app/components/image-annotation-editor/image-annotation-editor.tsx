import { useState, useRef, useCallback } from "react";
import type { Annotation, BadgeSide } from "~/services/instructions.server";
import { ImageAnnotationView } from "~/components/image-annotation-view/image-annotation-view";
import styles from "./image-annotation-editor.module.css";

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

const ANNOTATION_COLORS = [
  "#e5484d", // red
  "#0090ff", // blue
  "#30a46c", // green
  "#f76b15", // orange
  "#8e4ec6", // purple
  "#00a2c7", // cyan
];

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
 * Admin-only drag-to-draw annotation editor.
 * Click-drag on the image to draw a rectangle.
 * All coordinates are stored as percentages (0–100) of the image dimensions.
 * The numbered badge can be placed on any of the 4 outside corners of the rectangle.
 */
export function ImageAnnotationEditor({ src, annotations, onChange, onClose }: ImageAnnotationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Convert mouse event coords to percentage values relative to the image container */
  const toPercent = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const { x, y } = toPercent(e);
    setDraw({ startX: x, startY: y, currentX: x, currentY: y, active: true });
    setSelectedId(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draw?.active) return;
    const { x, y } = toPercent(e);
    setDraw((d) => d ? { ...d, currentX: x, currentY: y } : null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!draw?.active) return;
    const { x, y } = toPercent(e);
    const x1 = Math.min(draw.startX, x);
    const y1 = Math.min(draw.startY, y);
    const w = Math.abs(x - draw.startX);
    const h = Math.abs(y - draw.startY);

    if (w >= MIN_SIZE_PCT && h >= MIN_SIZE_PCT) {
      const nextLabel = annotations.length + 1;
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
    setDraw(null);
  };

  const deleteAnnotation = (id: string) => {
    const remaining = annotations.filter((a) => a.id !== id);
    // Re-number labels to keep them sequential
    const renumbered = remaining.map((a, i) => ({ ...a, label: i + 1 }));
    onChange(renumbered);
    if (selectedId === id) setSelectedId(null);
  };

  const updateAnnotationColor = (id: string, color: string) => {
    onChange(annotations.map((a) => (a.id === id ? { ...a, color } : a)));
  };

  const updateAnnotationBadgeSide = (id: string, badgeSide: BadgeSide) => {
    onChange(annotations.map((a) => (a.id === id ? { ...a, badgeSide } : a)));
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
          <span className={styles.toolbarLabel}>Rectangle color:</span>
          <div className={styles.colorPicker}>
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                className={`${styles.colorSwatch} ${selectedColor === c ? styles.colorSwatchActive : ""}`}
                style={{ background: c }}
                onClick={() => setSelectedColor(c)}
                title={c}
              />
            ))}
          </div>
          <span className={styles.toolbarHint}>Click &amp; drag on the image to draw a rectangle</span>
        </div>

        <div className={styles.canvasArea}>
          {/* Drawn annotations (view-only layer) */}
          <div
            ref={containerRef}
            className={styles.imageContainer}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: "crosshair" }}
          >
            <ImageAnnotationView src={src} annotations={annotations} />

            {/* Ghost rect while drawing */}
            {ghostRect && ghostRect.width > 0 && ghostRect.height > 0 && (
              <svg
                className={styles.ghostOverlay}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <rect
                  x={ghostRect.x}
                  y={ghostRect.y}
                  width={ghostRect.width}
                  height={ghostRect.height}
                  fill={`${selectedColor}22`}
                  stroke={selectedColor}
                  strokeWidth={0.5}
                  strokeDasharray="2 1"
                />
              </svg>
            )}
          </div>

          {/* Annotation list */}
          <div className={styles.annotationList}>
            <h3 className={styles.listTitle}>Annotations ({annotations.length})</h3>
            {annotations.length === 0 && (
              <p className={styles.listEmpty}>No annotations yet. Drag on the image to add one.</p>
            )}
            {annotations.map((ann) => {
              const isSelected = selectedId === ann.id;
              return (
                <div
                  key={ann.id}
                  className={`${styles.annotationRow} ${isSelected ? styles.annotationRowSelected : ""}`}
                  onClick={() => setSelectedId(isSelected ? null : ann.id)}
                >
                  {/* Top row: badge + coords + delete */}
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
                      className={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                      title="Delete annotation"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Controls — only visible when this row is selected */}
                  {isSelected && (
                    <div className={styles.annControlsRow}>
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
