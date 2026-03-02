import { EPSILON, resolveLensMetrics, computeDirectionMetrics, setBaseLensStyles, applyDebugDisplacementBackground, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  const mod = rad % TAU;
  return mod < 0 ? mod + TAU : mod;
}

export interface PrismOptions extends ResolveLensMetricsOptions {
  orientation?: number;
  intensity?: number;
  spread?: number;
  banding?: number;
  edgeSoftness?: number;
  strength?: number;
  dispersion?: number;
  blurAmount?: number;
  highlight?: boolean;
  autoRotate?: boolean;
  rotationSpeed?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
}

export class PrismLens {
  static createDisplacementMap({
    size,
    width,
    height,
    borderRadius,
    orientation = 30,
    intensity = 0.5,
    spread = 0.35,
    banding = 0.4,
    edgeSoftness = 0.15,
  }: Pick<PrismOptions, "size" | "width" | "height" | "borderRadius" | "orientation" | "intensity" | "spread" | "banding" | "edgeSoftness">): string {
    const { width: resolvedWidth, height: resolvedHeight, borderRadius: resolvedRadius } = resolveLensMetrics({ size, width, height, borderRadius });
    const clampedEdgeSoftness = Math.max(0.001, edgeSoftness);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(resolvedWidth);
    canvas.height = Math.round(resolvedHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    const angle = normalizeAngle(orientation);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const perpX = -dirY;
    const perpY = dirX;

    const baseScale = intensity * Math.min(canvas.width, canvas.height) * 0.6;
    const spreadFactor = Math.max(spread, 0.05);
    const bandFrequency = Math.max(banding, 0.05) * 8;

    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x - halfWidth;
        const dy = y - halfHeight;
        const idx = (y * canvas.width + x) * 4;

        const metrics = computeDirectionMetrics(dx, dy, halfWidth, halfHeight, resolvedRadius);
        const normalizedDist = metrics.normalized;

        if (normalizedDist >= 1 - EPSILON) {
          data[idx] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
          data[idx + 3] = 255;
          continue;
        }

        const nx = dx / canvas.width;
        const ny = dy / canvas.height;

        const projAxis = nx * dirX + ny * dirY;
        const projPerp = nx * perpX + ny * perpY;

        const falloff = Math.exp(-Math.pow(Math.abs(projPerp) / spreadFactor, 2));

        let edgeFade = 1;
        if (normalizedDist > 1 - clampedEdgeSoftness) {
          const ratio = (1 - normalizedDist) / clampedEdgeSoftness;
          edgeFade = clamp(ratio, 0, 1);
        }

        const fade = falloff * edgeFade;

        const displacementMag = baseScale * projAxis * fade;
        const bandWave = Math.sin((projAxis + 0.5) * Math.PI * bandFrequency) * fade * 0.25;

        const displacementX = displacementMag * dirX + bandWave * perpX * baseScale * 0.1;
        const displacementY = displacementMag * dirY + bandWave * perpY * baseScale * 0.1;

        data[idx] = clamp(128 + displacementX * 2, 0, 255);
        data[idx + 1] = clamp(128 + displacementY * 2, 0, 255);
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  static createFilter({
    size,
    width,
    height,
    borderRadius,
    orientation = 30,
    intensity = 0.5,
    spread = 0.35,
    banding = 0.4,
    edgeSoftness = 0.15,
    strength = 60,
    dispersion = 28,
    blurAmount = 0,
  }: PrismOptions): string {
    const { width: resolvedWidth, height: resolvedHeight } = resolveLensMetrics({ size, width, height, borderRadius });
    const disp = this.createDisplacementMap({ size, width, height, borderRadius, orientation, intensity, spread, banding, edgeSoftness });
    const redScale = strength + dispersion;
    const greenScale = strength;
    const blueScale = Math.max(strength - dispersion, 0);
    const svg = `<svg height="${resolvedHeight}" width="${resolvedWidth}" viewBox="0 0 ${resolvedWidth} ${resolvedHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="prism" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" height="${resolvedHeight}" width="${resolvedWidth}" href="${disp}" result="map" />
      ${blurAmount > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmount}" result="blur" />` : ""}
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${redScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="R"/>
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${greenScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="G"/>
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${blueScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="B"/>
      <feBlend in="R" in2="G" mode="screen" result="RG"/>
      <feBlend in="RG" in2="B" mode="screen"/>
    </filter>
  </defs>
</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg) + "#prism";
  }

  static apply(element: HTMLElement, options: PrismOptions): HTMLElement {
    const {
      size,
      width,
      height,
      borderRadius,
      orientation = 30,
      intensity = 0.5,
      spread = 0.35,
      banding = 0.4,
      edgeSoftness = 0.15,
      strength = 60,
      dispersion = 28,
      blurAmount = 0,
      highlight = true,
      debug = false,
    } = options;
    const { width: resolvedWidth, height: resolvedHeight, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });

    const gradientAngle = orientation + 90;
    const background = highlight
      ? `linear-gradient(${gradientAngle}deg, rgba(255,255,255,0.45), rgba(255,255,255,0.05)), linear-gradient(${orientation}deg, rgba(255,255,255,0.2), rgba(255,255,255,0))`
      : "rgba(255,255,255,0.1)";

    setBaseLensStyles(element, {
      width: resolvedWidth,
      height: resolvedHeight,
      borderRadiusCss,
      background,
      border: "1px solid rgba(255,255,255,0.35)",
      boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
    });

    if (!highlight) {
      element.style.background = background;
    }

    if (debug) {
      const map = this.createDisplacementMap({ size, width, height, borderRadius, orientation, intensity, spread, banding, edgeSoftness });
      applyDebugDisplacementBackground(element, map);
      return element;
    }

    const filter = this.createFilter({ size, width, height, borderRadius, orientation, intensity, spread, banding, edgeSoftness, strength, dispersion, blurAmount });
    applyBackdropFilterCss(element, `url('${filter}') saturate(1.4)`);
    return element;
  }

  static createDraggable(options: PrismOptions): HTMLElement {
    const { initialX = 160, initialY = 160, className = "", autoRotate = false, rotationSpeed = 0.6 } = options;
    const el = document.createElement("div");
    if (className) el.className = className;
    this.apply(el, options);
    makeDraggable(el, initialX, initialY);

    if (autoRotate && !options.debug && typeof window !== "undefined") {
      let currentOrientation = options.orientation ?? 0;
      const interval = window.setInterval(() => {
        currentOrientation = (currentOrientation + rotationSpeed) % 360;
        const previousLeft = el.style.left;
        const previousTop = el.style.top;
        this.apply(el, { ...options, orientation: currentOrientation });
        el.style.left = previousLeft;
        el.style.top = previousTop;
      }, 1000 / 60);
      (el as any)._cleanup = () => {
        window.clearInterval(interval);
      };
    }

    return el;
  }
}


