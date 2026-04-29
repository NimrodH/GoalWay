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
 * Ghost SVG overlay that uses the same viewBox as ImageAnnotationView
 * so the drawn rectangle lines up perfectly with the saved annotation.
 */
function GhostRect({
  rect,
  color,
  imgRef,
  className,
  isRedact = false,
}: {
  rect: { x: number; y: number; width: number; height: number };
  color: string;
  imgRef: React.RefObject<HTMLImageElement | null>;
  className?: string;
  isRedact?: boolean;
}) {
  // Mirror exactly what ImageAnnotationView does:
  // viewBox = "0 0 100 vbHeight" where vbHeight = 100 / (renderedW / renderedH)
  const img = imgRef.current;
  const w = img?.clientWidth ?? 0;
  const h = img?.clientHeight ?? 1;
  const aspectRatio = w && h ? w / h : 16 / 9;
  const vbHeight = 100 / aspectRatio;
  const scaleY = vbHeight / 100;

  return (
    <svg
      className={className}
      viewBox={`0 0 100 ${vbHeight}`}
      preserveAspectRatio="none"
    >
      {isRedact ? (
        // Redaction preview: solid fill with 70% opacity so you can see what you're covering
        <rect
          x={rect.x}
          y={rect.y * scaleY}
          width={rect.width}
          height={rect.height * scaleY}
          fill="#d4d4d4"
          fillOpacity={0.7}
          stroke="#888"
          strokeWidth={0.4}
          strokeDasharray="2 1"
        />
      ) : (
        <rect
          x={rect.x}
          y={rect.y * scaleY}
          width={rect.width}
          height={rect.height * scaleY}
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

  /**
   * Convert a mouse event position to percentage coordinates relative to
   * the rendered <img> element. We measure against the img element itself
   * (not the wrapper div) so that x% is truly "% of image width" and y%
   * is truly "% of image height" — matching how the view SVG interprets them.
   */
  const toPercent = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const img = imgRef.current;
    const fallback = imageWrapperRef.current ?? containerRef.current;
    const el: Element | null = img ?? fallback;
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

          {/* Color picker — only shown in annotate mode */}
          {drawMode === "annotate" && (
            <>
              <span className={styles.toolbarLabel}>Color:</span>
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
            </>
          )}

          {drawMode === "redact" && (
            <span className={styles.redactHint}>
              Draws an opaque light-gray block — hides content, no number
            </span>
          )}

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
            />

            {/* Ghost rect while drawing — uses same viewBox as the view SVG */}
            {ghostRect && ghostRect.width > 0 && ghostRect.height > 0 && (
              <GhostRect
                rect={ghostRect}
                color={drawMode === "redact" ? "#a0a0a0" : selectedColor}
                imgRef={imgRef}
                className={styles.ghostOverlay}
                isRedact={drawMode === "redact"}
              />
            )}
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
                      <div className={styles.redactionBadge}>▬</div>
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
