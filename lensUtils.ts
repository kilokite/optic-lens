/**
 * Lens Utility Functions
 * Common lens utility functions
 */

export const EPSILON = 1e-6;

export interface LensMetrics {
  width: number;
  height: number;
  borderRadius: number;
  borderRadiusCss: string;
}

export interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface DirectionMetrics {
  normalized: number;
  maxDistance: number;
}

/**
 * Resolve lens dimensions and border radius
 */
export function resolveLensMetrics({
  size,
  width,
  height,
  borderRadius,
}: ResolveLensMetricsOptions): LensMetrics {
  const resolvedWidthRaw = width ?? size;
  const resolvedHeightRaw = height ?? size ?? resolvedWidthRaw;

  if (resolvedWidthRaw == null || resolvedHeightRaw == null) {
    throw new Error("Lens requires a size or explicit width/height.");
  }

  const numericWidth =
    typeof resolvedWidthRaw === "string"
      ? parseFloat(resolvedWidthRaw)
      : resolvedWidthRaw;
  const numericHeight =
    typeof resolvedHeightRaw === "string"
      ? parseFloat(resolvedHeightRaw)
      : resolvedHeightRaw;

  if (!Number.isFinite(numericWidth) || !Number.isFinite(numericHeight)) {
    throw new Error("Invalid lens dimensions.");
  }

  const clampedWidth = Math.max(1, numericWidth);
  const clampedHeight = Math.max(1, numericHeight);
  const maxRadius = Math.min(clampedWidth, clampedHeight) / 2;

  let radiusPx: number;

  if (borderRadius == null) {
    radiusPx = maxRadius;
  } else if (
    typeof borderRadius === "number" &&
    !Number.isNaN(borderRadius)
  ) {
    radiusPx = borderRadius;
  } else if (typeof borderRadius === "string") {
    // Check if it's a percentage format (e.g., "50%")
    if (borderRadius.trim().endsWith("%")) {
      const percentValue = parseFloat(borderRadius.trim().replace("%", ""));
      if (Number.isFinite(percentValue) && percentValue >= 0) {
        // Percentage is calculated based on the minimum dimension, similar to CSS border-radius behavior
        const minDimension = Math.min(clampedWidth, clampedHeight);
        radiusPx = (minDimension * percentValue) / 100;
      } else {
        radiusPx = maxRadius;
      }
    } else {
      // Non-percentage string, try to parse as pixel value
    const parsed = parseFloat(borderRadius);
    radiusPx = Number.isFinite(parsed) ? parsed : maxRadius;
    }
  } else {
    radiusPx = maxRadius;
  }

  if (!Number.isFinite(radiusPx)) {
    radiusPx = maxRadius;
  }

  radiusPx = Math.max(0, Math.min(radiusPx, maxRadius));

  const borderRadiusCss =
    borderRadius != null
      ? typeof borderRadius === "number"
        ? `${radiusPx}px`
        : `${borderRadius}`
      : `${radiusPx}px`;

  return {
    width: clampedWidth,
    height: clampedHeight,
    borderRadius: radiusPx,
    borderRadiusCss,
  };
}

/**
 * Compute normalized coordinates and distance from point to rounded rectangle boundary
 */
export function computeDirectionMetrics(
  dx: number,
  dy: number,
  halfWidth: number,
  halfHeight: number,
  borderRadius: number
): DirectionMetrics {
  const ux = Math.abs(dx);
  const uy = Math.abs(dy);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < EPSILON) {
    const maxDistance = Math.min(halfWidth, halfHeight);
    return {
      normalized: 0,
      maxDistance,
    };
  }

  const radius = Math.min(borderRadius, halfWidth, halfHeight);
  const innerX = Math.max(halfWidth - radius, 0);
  const innerY = Math.max(halfHeight - radius, 0);

  let tMin = Infinity;

  if (ux > EPSILON) {
    const tVertical = halfWidth / ux;
    const yAt = uy * tVertical;
    if (radius <= EPSILON || yAt <= innerY + EPSILON) {
      tMin = Math.min(tMin, tVertical);
    }
  }

  if (uy > EPSILON) {
    const tHorizontal = halfHeight / uy;
    const xAt = ux * tHorizontal;
    if (radius <= EPSILON || xAt <= innerX + EPSILON) {
      tMin = Math.min(tMin, tHorizontal);
    }
  }

  if (radius > EPSILON) {
    const cx = innerX;
    const cy = innerY;
    const A = ux * ux + uy * uy;

    if (A > EPSILON) {
      const B = -2 * (ux * cx + uy * cy);
      const C = cx * cx + cy * cy - radius * radius;
      const discriminant = B * B - 4 * A * C;

      if (discriminant >= -EPSILON) {
        const sqrtD = Math.sqrt(Math.max(0, discriminant));
        const inv2A = 1 / (2 * A);
        const candidates = [
          (-B - sqrtD) * inv2A,
          (-B + sqrtD) * inv2A,
        ];

        for (const t of candidates) {
          if (t > EPSILON) {
            const xAt = ux * t;
            const yAt = uy * t;
            if (xAt >= cx - EPSILON && yAt >= cy - EPSILON) {
              tMin = Math.min(tMin, t);
            }
          }
        }
      }
    }
  }

  if (!Number.isFinite(tMin) || tMin <= EPSILON) {
    let fallback = Infinity;
    if (ux > EPSILON) {
      fallback = Math.min(fallback, halfWidth / ux);
    }
    if (uy > EPSILON) {
      fallback = Math.min(fallback, halfHeight / uy);
    }
    if (!Number.isFinite(fallback) || fallback <= EPSILON) {
      fallback = 1;
    }
    tMin = fallback;
  }

  const normalized = Math.min(1 / tMin, 1);
  const maxDistance = distance * tMin;

  return {
    normalized,
    maxDistance,
  };
}

/**
 * Convert normalized coordinates to actual pixel offset
 */
export function normalizedToReal(
  normX: number,
  normY: number,
  halfWidth: number,
  halfHeight: number,
  borderRadius: number
): { x: number; y: number } {
  const length = Math.sqrt(normX * normX + normY * normY);
  if (length < EPSILON) {
    return { x: 0, y: 0 };
  }

  const dirX = normX / length;
  const dirY = normY / length;
  const { maxDistance } = computeDirectionMetrics(
    dirX,
    dirY,
    halfWidth,
    halfHeight,
    borderRadius
  );
  const distance = maxDistance * length;

  return {
    x: dirX * distance,
    y: dirY * distance,
  };
}

/**
 * Set base styles for lens element
 */
export function setBaseLensStyles(
  element: HTMLElement,
  options: {
    width: number;
    height: number;
    borderRadiusCss: string;
    background: string;
    border: string;
    boxShadow: string;
    position?: string;
    cursor?: string;
    overflow?: string;
    zIndex?: string;
  }
): void {
  element.style.boxSizing = "border-box";
  element.style.width = `${options.width}px`;
  element.style.height = `${options.height}px`;
  element.style.borderRadius = options.borderRadiusCss;
  element.style.background = options.background;
  element.style.border = options.border;
  element.style.boxShadow = options.boxShadow;
  element.style.position = options.position ?? "absolute";
  element.style.cursor = options.cursor ?? "pointer";
  element.style.overflow = options.overflow ?? "hidden";
  element.style.zIndex = options.zIndex ?? "500";
}

/**
 * Apply displacement map to background in debug mode
 */
export function applyDebugDisplacementBackground(element: HTMLElement, displacementUrl: string): void {
  element.style.background = `url("${displacementUrl}")`;
  element.style.backgroundSize = "cover";
  element.style.border = "2px solid red";
  element.style.backdropFilter = "none";
  (element.style as any).webkitBackdropFilter = "none";
}

/**
 * Apply backdropFilter (automatically sync webkitBackdropFilter)
 */
export function applyBackdropFilterCss(element: HTMLElement, css: string): void {
  element.style.backdropFilter = css;
  (element.style as any).webkitBackdropFilter = css;
}

/**
 * Make element draggable
 */
export function makeDraggable(element: HTMLElement, initialX: number, initialY: number): void {
  element.style.left = `${initialX}px`;
  element.style.top = `${initialY}px`;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  element.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    element.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    element.style.cursor = "pointer";
  });

  element.addEventListener("mouseenter", () => {
    if (!isDragging) {
      element.style.transform = "scale(1.02)";
      element.style.transition = "transform 0.2s ease";
    }
  });

  element.addEventListener("mouseleave", () => {
    element.style.transform = "scale(1)";
  });
}

