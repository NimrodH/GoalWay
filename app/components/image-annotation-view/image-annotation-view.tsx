import { useState, useRef, useEffect, Fragment } from "react";
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
 * the non-uniform SVG scaling.  rx and ry are computed from the **rendered**
 * image dimensions (via ResizeObserver) so the badge is always
 * BADGE_PX_RADIUS screen-pixels in radius regardless of the source image size.
 */

/** Desired on-screen badge radius in pixels (minimum guaranteed size). */
const BADGE_PX_RADIUS = 10;

/**
 * Computes badge ellipse radii (in SVG units = % of image dimension) so the
 * badge appears as a circle of BADGE_PX_RADIUS pixels on screen.
 *
 * Uses the **rendered** image dimensions so the badge is always the same
 * physical size on screen, even when the source image is very large.
 *
 * @param renderedW rendered image width in px
 * @param renderedH rendered image height in px
 */
function badgeRadii(renderedW: number, renderedH: number): { rx: number; ry: number } {
  // 1 SVG x-unit = renderedW/100 px  →  rx (svg) = BADGE_PX_RADIUS / (renderedW/100)
  // 1 SVG y-unit = renderedH/100 px  →  ry (svg) = BADGE_PX_RADIUS / (renderedH/100)
  const rx = (BADGE_PX_RADIUS / renderedW) * 100;
  const ry = (BADGE_PX_RADIUS / renderedH) * 100;
  return { rx, ry };
}

/**
 * Badge font size in SVG y-units so the number is correctly proportioned
 * inside the ellipse on screen. Using ry (y-units) avoids distortion from
 * the non-uniform SVG scaling (preserveAspectRatio="none").
 *
 * @param ry badge ellipse y-radius in SVG y-units
 */
function badgeFontSize(ry: number): number {
  // 1.1× ry gives a comfortably readable number that fills the circle nicely
  return ry * 1.1;
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

  // Track rendered image dimensions via ResizeObserver so badge size is always
  // BADGE_PX_RADIUS screen-pixels regardless of the source image resolution.
  // We also use the aspect ratio to un-stretch the badge text — since
  // preserveAspectRatio="none" warps text horizontally, we apply a scaleX
  // correction: scaleX = (svgUnitX / svgUnitY) = (H/W) so text renders square.
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const update = () => {
      if (img.clientWidth && img.clientHeight) {
        setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => ro.disconnect();
  }, [imgRef]);

  if (!src) return null;

  // Use rendered image dimensions for badge sizing — always BADGE_PX_RADIUS px on screen.
  // Fall back to a square assumption until the image has been measured.
  const renderedW = renderedSize?.w ?? 200;
  const renderedH = renderedSize?.h ?? 200;
  const { rx: badgeRx, ry: badgeRy } = badgeRadii(renderedW, renderedH);
  const fontSize = badgeFontSize(badgeRy);
  // Correct horizontal text distortion from preserveAspectRatio="none":
  // 1 x-unit = renderedW/100 px, 1 y-unit = renderedH/100 px.
  // To make text square we scale x by (y-unit-px / x-unit-px) = renderedH/renderedW.
  const textScaleX = renderedH / renderedW;

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
          onLoad={() => {
            const img = imgRef.current;
            if (img?.clientWidth && img?.clientHeight) {
              setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
            }
          }}
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
                const rcx = ax + aw / 2;
                const rcy = ay + ah / 2;
                // Font size: use stored value or auto-compute (30% of rect height, capped at 4.5 SVG-y-units)
                const redactFontSize = ann.fontSize ?? Math.min(ah * 0.3, 4.5);
                // Contrast text: dark text for light (#d4d4d4) redactions, white for everything else
                const textFill = (ann.color === "#d4d4d4" || !ann.color) ? "#222" : "rgba(255,255,255,0.95)";
                const lines = ann.text ? ann.text.split("\n").filter((l) => l.length > 0) : [];
                const lineH = redactFontSize * 1.35;
                const totalTextH = lines.length * lineH;
                const textStartY = rcy - totalTextH / 2 + lineH * 0.5;

                return (
                  <Fragment key={ann.id}>
                    {lines.length > 0 && (
                      <clipPath id={`redact-clip-${ann.id}`}>
                        <rect
                          x={ax + 1}
                          y={ay + 1}
                          width={Math.max(0, aw - 2)}
                          height={Math.max(0, ah - 2)}
                        />
                      </clipPath>
                    )}
                    <rect
                      x={ax}
                      y={ay}
                      width={aw}
                      height={ah}
                      fill={ann.color || "#d4d4d4"}
                      stroke="none"
                    />
                    {lines.map((line, i) => {
                      const lineY = textStartY + i * lineH;
                      return (
                        <text
                          key={i}
                          x={rcx}
                          y={lineY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={textFill}
                          fontSize={redactFontSize}
                          fontWeight="600"
                          clipPath={`url(#redact-clip-${ann.id})`}
                          transform={`translate(${rcx},${lineY}) scale(${textScaleX},1) translate(${-rcx},${-lineY})`}
                          style={{ fontFamily: "system-ui, sans-serif", userSelect: "none" }}
                        >
                          {line}
                        </text>
                      );
                    })}
                  </Fragment>
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
                    transform={`translate(${cx},${cy}) scale(${textScaleX},1) translate(${-cx},${-cy})`}
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
