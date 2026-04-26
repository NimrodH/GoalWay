import { useRef, useState } from "react";
import type { Annotation } from "~/services/instructions.server";
import styles from "./image-annotation-view.module.css";

interface ImageAnnotationViewProps {
  src: string;
  alt?: string;
  annotations?: Annotation[];
  className?: string;
}

/**
 * Renders an image with SVG annotation overlays (rectangles + numbered labels).
 * Annotations use percentage-based coordinates so they are fully responsive
 * and look identical on any screen size.
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
                {/* Circle badge for label number */}
                <circle
                  cx={ann.x + 1.5}
                  cy={ann.y + 1.5}
                  r={1.8}
                  fill={color}
                />
                <text
                  x={ann.x + 1.5}
                  y={ann.y + 2.1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={2}
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
