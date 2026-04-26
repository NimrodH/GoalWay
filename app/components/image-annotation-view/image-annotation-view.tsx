import { useState } from "react";
import type { Annotation, BadgeSide } from "~/services/instructions.server";
import styles from "./image-annotation-view.module.css";

/** Badge radius in SVG viewBox units (0–100 space) */
const BADGE_R = 3;

/**
 * Computes the center (cx, cy) of the badge circle so it sits
 * *outside* the rectangle corner specified by `badgeSide`.
 */
function badgeCenter(
  ann: Annotation,
  side: BadgeSide
): { cx: number; cy: number } {
  const { x, y, width, height } = ann;
  switch (side) {
    case "top-right":
      return { cx: x + width + BADGE_R, cy: y - BADGE_R };
    case "bottom-left":
      return { cx: x - BADGE_R, cy: y + height + BADGE_R };
    case "bottom-right":
      return { cx: x + width + BADGE_R, cy: y + height + BADGE_R };
    case "top-left":
    default:
      return { cx: x - BADGE_R, cy: y - BADGE_R };
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

  if (!src) return null;

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <img src={src} alt={alt} className={styles.image} />
      {annotations.length > 0 && (
        <svg
          className={styles.overlay}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {annotations.map((ann) => {
            const isHovered = hoveredId === ann.id;
            const color = ann.color || "#e5484d";
            const side: BadgeSide = ann.badgeSide ?? "top-left";
            const { cx, cy } = badgeCenter(ann, side);

            return (
              <g
                key={ann.id}
                onMouseEnter={() => setHoveredId(ann.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "default" }}
              >
                {/* Rectangle */}
                <rect
                  x={ann.x}
                  y={ann.y}
                  width={ann.width}
                  height={ann.height}
                  fill={isHovered ? `${color}33` : `${color}1a`}
                  stroke={color}
                  strokeWidth={isHovered ? 0.6 : 0.4}
                  rx={0.4}
                />
                {/* Badge circle — outside the rectangle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={BADGE_R}
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
