import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Annotation, BadgeSide } from "~/services/instructions.server";
import styles from "./image-annotation-view.module.css";

/**
 * Badge radius as a percentage of the image width (x-axis units).
 * The y-axis radius is scaled by (1/aspectRatio) so that the badge
 * renders as a true circle even though the SVG uses preserveAspectRatio="none".
 */
const BADGE_R_X = 2.8;

/**
 * Computes the badge center so it sits *outside* the chosen rectangle corner.
 * All values are in SVG viewBox units (x: 0-100, y: 0-vbHeight).
 */
function badgeCenter(
  ann: { x: number; y: number; width: number; height: number },
  side: BadgeSide,
  badgeRx: number,
  badgeRy: number
): { cx: number; cy: number } {
  const { x, y, width, height } = ann;
  switch (side) {
    case "top-right":
      return { cx: x + width + badgeRx, cy: y - badgeRy };
    case "bottom-left":
      return { cx: x - badgeRx, cy: y + height + badgeRy };
    case "bottom-right":
      return { cx: x + width + badgeRx, cy: y + height + badgeRy };
    case "top-left":
    default:
      return { cx: x - badgeRx, cy: y - badgeRy };
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
 *
 * Coordinate system:
 *   x, width  — stored as % of rendered image width  (= SVG viewBox x units, 0–100)
 *   y, height — stored as % of rendered image height (scaled by scaleY into viewBox)
 *
 * The SVG viewBox is "0 0 100 vbHeight" where vbHeight = 100 / aspectRatio.
 * scaleY = vbHeight / 100 converts y/height from "% of image height" → viewBox units.
 * This means annotations look correct on any screen size without any letterboxing math.
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
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9); // default until loaded

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Use the *rendered* dimensions (clientWidth/clientHeight) so the SVG
    // viewBox matches exactly what the user sees on any screen size.
    const update = () => {
      const w = img.clientWidth;
      const h = img.clientHeight;
      if (w && h) {
        setAspectRatio(w / h);
      } else if (img.naturalWidth && img.naturalHeight) {
        // Fallback before layout is complete
        setAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };

    if (img.complete && img.clientWidth) {
      update();
    } else {
      img.addEventListener("load", update);
    }

    // Re-measure on container resize (window resize, panel open/close, etc.)
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => {
      img.removeEventListener("load", update);
      ro.disconnect();
    };
  }, [src, imgRef]);

  if (!src) return null;

  // viewBox: width = 100, height = 100 / aspectRatio
  // x/width annotation values are used directly (% of width = viewBox x units)
  // y/height annotation values need scaleY applied (% of height → viewBox y units)
  const vbHeight = 100 / aspectRatio;
  const scaleY = vbHeight / 100;
  // Badge x-radius is in x-axis units (% of width).
  // Badge y-radius must be scaled so the badge looks like a circle on screen:
  // since the SVG is non-uniformly scaled (preserveAspectRatio=none), 1 x-unit
  // covers (renderedWidth / 100) pixels and 1 y-unit covers (renderedHeight / vbHeight)
  // pixels. To make rx pixels == ry pixels: ry = rx * (renderedWidth / renderedHeight) / (100 / vbHeight)
  // = rx * aspectRatio * (vbHeight / 100) = rx * aspectRatio * scaleY = rx / aspectRatio * aspectRatio^2 * scaleY
  // Simplified: badgeRy = BADGE_R_X * scaleY (because scaleY = 1/aspectRatio when vbHeight=100/aspectRatio)
  // In x-units: BADGE_R_X. In y-units (same pixel size): BADGE_R_X * scaleY.
  const badgeRx = BADGE_R_X;
  const badgeRy = BADGE_R_X * scaleY;

  // Redaction blocks and regular annotations are rendered separately
  const regularAnnotations = annotations.filter((a) => !a.isRedaction);
  // Only show caption list if at least one non-redaction annotation has non-empty text
  const captionAnnotations = regularAnnotations.filter((a) => a.text && a.text.trim().length > 0);

  return (
    <div className={`${styles.outerWrapper} ${className ?? ""}`}>
      <div className={styles.wrapper} ref={wrapperRef}>
        <img ref={imgRef} src={src} alt={alt} className={styles.image} />
        {ghostOverlay}
        {annotations.length > 0 && (
          <svg
            className={styles.overlay}
            viewBox={`0 0 100 ${vbHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {annotations.map((ann) => {
              // x/width: stored as % of image width → use directly as viewBox x units
              // y/height: stored as % of image height → multiply by scaleY for viewBox y units
              const ax = ann.x;
              const ay = ann.y * scaleY;
              const aw = ann.width;
              const ah = ann.height * scaleY;

              // Redaction: opaque solid block, no border, no badge
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

              const scaledAnn = { x: ax, y: ay, width: aw, height: ah };
              const { cx, cy } = badgeCenter(scaledAnn, side, badgeRx, badgeRy);

              return (
                <g
                  key={ann.id}
                  onMouseEnter={() => setHoveredId(ann.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: "default" }}
                >
                  {/* Rectangle */}
                  <rect
                    x={ax}
                    y={ay}
                    width={aw}
                    height={ah}
                    fill={isHovered ? `${color}33` : `${color}1a`}
                    stroke={color}
                    strokeWidth={isHovered ? 0.6 : 0.4}
                    rx={0.4}
                  />
                  {/* Badge — ellipse with separate rx/ry so it renders as a true
                      circle despite the SVG using preserveAspectRatio="none" */}
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={badgeRx}
                    ry={badgeRy}
                    fill={color}
                    stroke="white"
                    strokeWidth={0.35}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={2.8}
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
