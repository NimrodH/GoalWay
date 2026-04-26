import { useState, useRef, useEffect } from "react";
import type { Annotation, BadgeSide } from "~/services/instructions.server";
import styles from "./image-annotation-view.module.css";

/** Badge radius as a percentage of the image width */
const BADGE_R_PCT = 3;

/**
 * Computes the badge center so it sits *outside* the chosen rectangle corner.
 * `badgeR` is expressed in the same % units as the annotation coordinates.
 * We use separate x/y radii to keep the badge a true circle despite the
 * image's aspect ratio (handled by the SVG viewBox in ImageAnnotationView).
 */
function badgeCenter(
  ann: Annotation,
  side: BadgeSide,
  badgeR: number
): { cx: number; cy: number } {
  const { x, y, width, height } = ann;
  switch (side) {
    case "top-right":
      return { cx: x + width + badgeR, cy: y - badgeR };
    case "bottom-left":
      return { cx: x - badgeR, cy: y + height + badgeR };
    case "bottom-right":
      return { cx: x + width + badgeR, cy: y + height + badgeR };
    case "top-left":
    default:
      return { cx: x - badgeR, cy: y - badgeR };
  }
}

interface ImageAnnotationViewProps {
  src: string;
  alt?: string;
  annotations?: Annotation[];
  className?: string;
}

/**
 * Renders an image with SVG annotation overlays (rectangles + numbered labels).
 * Annotations use percentage-based coordinates so they are fully responsive.
 * The numbered badge is placed *outside* the rectangle corner chosen by `badgeSide`.
 */
export function ImageAnnotationView({ src, alt = "", annotations = [], className }: ImageAnnotationViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9); // default until loaded

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    if (img.complete) update();
    else img.addEventListener("load", update);
    return () => img.removeEventListener("load", update);
  }, [src]);

  if (!src) return null;

  // viewBox: width = 100, height = 100 / aspectRatio → uniform units in both axes
  // so r=BADGE_R_PCT renders as a true circle regardless of image shape.
  const vbHeight = 100 / aspectRatio;
  const badgeR = BADGE_R_PCT; // same units as annotation coords (% of width)
  // annotation coords are stored as % of width for x/width,
  // and % of height for y/height — we need to convert y/height to vbHeight space
  const scaleY = vbHeight / 100; // maps annotation % heights to viewBox units

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <img ref={imgRef} src={src} alt={alt} className={styles.image} />
      {annotations.length > 0 && (
        <svg
          className={styles.overlay}
          viewBox={`0 0 100 ${vbHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {annotations.map((ann) => {
            const isHovered = hoveredId === ann.id;
            const color = ann.color || "#e5484d";
            const side: BadgeSide = ann.badgeSide ?? "top-left";

            // Convert annotation coords: x/width stay as-is (% of width = vb units)
            // y/height are % of image height → scale to vbHeight space
            const ax = ann.x;
            const ay = ann.y * scaleY;
            const aw = ann.width;
            const ah = ann.height * scaleY;

            const scaledAnn = { ...ann, x: ax, y: ay, width: aw, height: ah };
            const { cx, cy } = badgeCenter(scaledAnn, side, badgeR);

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
                {/* Badge — true circle outside the rectangle corner */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={badgeR}
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
  );
}
