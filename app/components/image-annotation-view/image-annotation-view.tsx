import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Annotation, BadgeSide } from "~/services/instructions.server";
import styles from "./image-annotation-view.module.css";

/**
 * Coordinate system (simple & unified):
 *   x, width  — stored as % of rendered image width  (SVG viewBox x: 0–100)
 *   y, height — stored as % of rendered image height (SVG viewBox y: 0–100)
 *
 * The SVG uses viewBox="0 0 100 100" with preserveAspectRatio="none" so it
 * stretches to cover the image exactly.  1 SVG unit in x = 1% of image width;
 * 1 SVG unit in y = 1% of image height.  Coordinates map directly — no scaleY
 * conversion needed.
 *
 * The badge uses <ellipse rx ry> so it looks like a circle on screen despite
 * the non-uniform SVG scaling.  rx and ry are computed from the image's
 * rendered aspect ratio so the badge has equal pixel dimensions on both axes.
 */

const BADGE_PX_RADIUS = 20; // desired on-screen badge radius in pixels

/**
 * Computes badge ellipse radii (in SVG units = % of image dimension) so the
 * badge appears as a circle of BADGE_PX_RADIUS pixels on screen.
 *
 * @param imgW rendered image width in px
 * @param imgH rendered image height in px
 */
function badgeRadii(imgW: number, imgH: number): { rx: number; ry: number } {
  // 1 SVG x-unit = imgW/100 px  →  rx (svg) = BADGE_PX_RADIUS / (imgW/100)
  // 1 SVG y-unit = imgH/100 px  →  ry (svg) = BADGE_PX_RADIUS / (imgH/100)
  const rx = (BADGE_PX_RADIUS / imgW) * 100;
  const ry = (BADGE_PX_RADIUS / imgH) * 100;
  return { rx, ry };
}

/**
 * Badge font size in SVG x-units so the number fits inside the ellipse.
 */
function badgeFontSize(rx: number): number {
  return rx * 1.1;
}

/**
 * Computes the badge center so it sits *outside* the chosen rectangle corner.
 * All values are in SVG viewBox units (x: 0-100, y: 0-100).
 */
function badgeCenter(
  ann: { x: number; y: number; width: number; height: number },
  side: BadgeSide,
  rx: number,
  ry: number
): { cx: number; cy: number } {
  const { x, y, width, height } = ann;
  switch (side) {
    case "top-right":
      return { cx: x + width + rx, cy: y - ry };
    case "bottom-left":
      return { cx: x - rx, cy: y + height + ry };
    case "bottom-right":
      return { cx: x + width + rx, cy: y + height + ry };
    case "top-left":
    default:
      return { cx: x - rx, cy: y - ry };
  }
}

interface ImageAnnotationViewProps {
  src: string;
  alt?: string;
  annotations?: Annotation[];
  className?: string;
  /** When false, the caption list below the image is hidden. Defaults to true. */
  captionVisible?: boolean;
  /** Optional ref forwarded to the image wrapper div (excludes caption list). */
  wrapperRef?: React.RefObject<HTMLDivElement | null>;
  /** Optional ref forwarded to the <img> element itself. */
  imgRef?: React.RefObject<HTMLImageElement | null>;
  /** Optional overlay element rendered inside the image wrapper (e.g. ghost drag rect). */
  ghostOverlay?: React.ReactNode;
}

/**
 * Renders an image with SVG annotation overlays (rectangles + numbered labels).
 */
export function ImageAnnotationView({
  src,
  alt = "",
  annotations = [],
  className,
  captionVisible = true,
  wrapperRef,
  imgRef: externalImgRef,
  ghostOverlay,
}: ImageAnnotationViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const internalImgRef = useRef<HTMLImageElement>(null);
  const imgRef = externalImgRef ?? internalImgRef;

  // We use a ref-based approach for badge sizing so we don't need to re-render
  // on every resize. The SVG viewBox is always 0 0 100 100, and badge radii
  // are computed from the natural aspect ratio (naturalWidth/naturalHeight).
  // For the badge to look circular, rx and ry compensate for the stretch.
  // We read naturalWidth/naturalHeight once the image loads — these are stable.
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  if (!src) return null;

  // Use natural image dimensions for badge sizing so the badge looks circular.
  // If image hasn't loaded yet, use a square assumption (radii will be equal).
  const naturalW = imgNaturalSize?.w ?? 1;
  const naturalH = imgNaturalSize?.h ?? 1;
  const { rx: badgeRx, ry: badgeRy } = badgeRadii(naturalW, naturalH);
  const fontSize = badgeFontSize(badgeRx);

  const regularAnnotations = annotations.filter((a) => !a.isRedaction);
  const captionAnnotations = regularAnnotations.filter((a) => a.text && a.text.trim().length > 0);

  return (
    <div className={`${styles.outerWrapper} ${className ?? ""}`}>
      <div className={styles.wrapper} ref={wrapperRef}>
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={styles.image}
          onLoad={handleImgLoad}
        />
        {ghostOverlay}
        {annotations.length > 0 && (
          <svg
            className={styles.overlay}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {annotations.map((ann) => {
              // Coordinates are already in % units — use directly.
              const ax = ann.x;
              const ay = ann.y;
              const aw = ann.width;
              const ah = ann.height;

              if (ann.isRedaction) {
                return (
                  <rect
                    key={ann.id}
                    x={ax}
                    y={ay}
                    width={aw}
                    height={ah}
                    fill={ann.color || "#d4d4d4"}
                    stroke="none"
                  />
                );
              }

              const isHovered = hoveredId === ann.id;
              const color = ann.color || "#e5484d";
              const side: BadgeSide = ann.badgeSide ?? "top-left";
              const { cx, cy } = badgeCenter({ x: ax, y: ay, width: aw, height: ah }, side, badgeRx, badgeRy);

              return (
                <g
                  key={ann.id}
                  onMouseEnter={() => setHoveredId(ann.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: "default" }}
                >
                  <rect
                    x={ax}
                    y={ay}
                    width={aw}
                    height={ah}
                    fill={isHovered ? `${color}33` : `${color}1a`}
                    stroke={color}
                    strokeWidth={isHovered ? 0.4 : 0.3}
                    rx={0.3}
                  />
                  {/* ellipse rx/ry compensates for non-uniform SVG scaling so
                      the badge renders as a circle on screen */}
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={badgeRx}
                    ry={badgeRy}
                    fill={color}
                    stroke="white"
                    strokeWidth={Math.min(badgeRx, badgeRy) * 0.12}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={fontSize}
                    fontWeight="bold"
                    style={{ fontFamily: "system-ui, sans-serif", userSelect: "none" }}
                  >
                    {ann.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {captionAnnotations.length > 0 && captionVisible && (
        <div className={styles.captionList}>
          {captionAnnotations.map((ann) => (
            <div key={ann.id} className={styles.captionRow}>
              <span
                className={styles.captionBadge}
                style={{ background: ann.color || "#e5484d" }}
              >
                {ann.label}
              </span>
              <div className={styles.captionText}>
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                  {ann.text!}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
