import { useState, useRef, useCallback, useEffect } from "react";
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
 * Ghost SVG overlay that uses the SAME viewBox as ImageAnnotationView
 * ("0 0 100 vbHeight" with preserveAspectRatio="none") so the drawn rectangle
 * lines up perfectly with the saved annotation.
 *
 * aspectRatio is the rendered image width / height, used to compute vbHeight.
 */
function GhostRect({
  rect,
  color,
  className,
  isRedact = false,
  aspectRatio,
}: {
  rect: { x: number; y: number; width: number; height: number };
  color: string;
  className?: string;
  isRedact?: boolean;
  aspectRatio: number;
}) {
  const vbHeight = 100 / aspectRatio;
  const scaleY = vbHeight / 100;
  const rx = rect.x;
  const ry = rect.y * scaleY;
  const rw = rect.width;
  const rh = rect.height * scaleY;

  return (
    <svg
      className={className}
      viewBox={`0 0 100 ${vbHeight}`}
      preserveAspectRatio="none"
    >
      {isRedact ? (
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          fill={color}
          fillOpacity={0.7}
          stroke={color === "#d4d4d4" ? "#888" : color}
          strokeWidth={0.4}
          strokeDasharray="2 1"
        />
      ) : (
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
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
 * This matches exactly how ImageAnnotationView interprets stored annotations
 * (it applies scaleY = vbHeight/100 to y/height values).
 */
export function ImageAnnotationEditor({ src, annotations, onChange, onClose }: ImageAnnotationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>("annotate");
  // Track the rendered aspect ratio of the image so the ghost viewBox matches the view SVG
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  // Measure aspect ratio from the <img> element (rendered dimensions, not natural)
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      if (img.clientWidth && img.clientHeight) {
        setAspectRatio(img.clientWidth / img.clientHeight);
      } else if (img.naturalWidth && img.naturalHeight) {
        setAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    if (img.complete && img.clientWidth) update();
    else img.addEventListener("load", update);
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => { img.removeEventListener("load", update); ro.disconnect(); };
  }, [src]);

  /**
   * Convert a mouse event position to percentage coordinates relative to
   * the rendered <img> element. We always measure against imgRef so that
   * x% = "% of image width" and y% = "% of image height", matching the
   * coordinate system used by ImageAnnotationView.
   */
  const toPercent = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
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

  const handleMouseUp = (_e: React.MouseEvent) => {
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

          <span className={styles.toolbarHint}>Click &amp; drag on the image to draw</span>
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
                    aspectRatio={aspectRatio}
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
                    className={`${styles.annotationRow} ${styles.redactionRow} ${isSelected ? styles.annotationRowSelected : ""}`}
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
                  </div>
                );
              }

              // ── Regular annotation row ───────────────────────────────────
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
