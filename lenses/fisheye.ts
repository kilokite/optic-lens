 import { EPSILON, resolveLensMetrics, computeDirectionMetrics, setBaseLensStyles, applyDebugDisplacementBackground, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface FisheyeOptions extends ResolveLensMetricsOptions {
  distortion?: number;
  edgeSoftness?: number;
  chromaticAberration?: number;
  blurAmount?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
}

export class FisheyeLens {
  static createDisplacementMap({
    size,
    width,
    height,
    borderRadius,
    distortion = 1.5,
    edgeSoftness = 0.2,
  }: Pick<FisheyeOptions, "size" | "width" | "height" | "borderRadius" | "distortion" | "edgeSoftness">): string {
    const { width: resolvedWidth, height: resolvedHeight, borderRadius: resolvedRadius } = resolveLensMetrics({ size, width, height, borderRadius });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(resolvedWidth);
    canvas.height = Math.round(resolvedHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const halfWidth = canvasWidth / 2;
    const halfHeight = canvasHeight / 2;

    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData.data;

    const clampedEdgeSoftness = Math.max(0, Math.min(edgeSoftness, 1));

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const idx = (y * canvasWidth + x) * 4;

        const metrics = computeDirectionMetrics(dx, dy, halfWidth, halfHeight, resolvedRadius);
        const normalizedDist = metrics.normalized;

        if (normalizedDist >= 1 - EPSILON) {
          data[idx] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
          data[idx + 3] = 255;
          continue;
        }

        let displacementFactor = 0;
        if (normalizedDist > 0.01) {
          const r = normalizedDist;
          const k = distortion * 0.5;
          displacementFactor = r * k * r * r;
          if (clampedEdgeSoftness > 0 && normalizedDist > 1 - clampedEdgeSoftness) {
            const edgeFade = (1 - normalizedDist) / clampedEdgeSoftness;
            displacementFactor *= Math.max(0, Math.min(1, edgeFade));
          }
        }

        let displacementX = 0;
        let displacementY = 0;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > EPSILON && metrics.maxDistance > EPSILON) {
          const displacementMagnitude = displacementFactor * metrics.maxDistance;
          displacementX = (dx / distance) * displacementMagnitude;
          displacementY = (dy / distance) * displacementMagnitude;
        }

        data[idx] = Math.max(0, Math.min(255, 128 + displacementX * 2));
        data[idx + 1] = Math.max(0, Math.min(255, 128 + displacementY * 2));
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
    distortion = 1.5,
    edgeSoftness = 0.2,
    chromaticAberration = 5,
    blurAmount = 0,
  }: FisheyeOptions): string {
    const { width: resolvedWidth, height: resolvedHeight } = resolveLensMetrics({ size, width, height, borderRadius });
    const displacementMapUrl = this.createDisplacementMap({ size, width, height, borderRadius, distortion, edgeSoftness });
    const baseDimension = Math.max(resolvedWidth, resolvedHeight);
    const baseScale = baseDimension * 0.5;
    const redScale = baseScale + chromaticAberration * 2;
    const greenScale = baseScale + chromaticAberration;
    const blueScale = baseScale;
    const svgContent = `<svg height="${resolvedHeight}" width="${resolvedWidth}" viewBox="0 0 ${resolvedWidth} ${resolvedHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="fisheye" color-interpolation-filters="sRGB">
            <feImage x="0" y="0" height="${resolvedHeight}" width="${resolvedWidth}" href="${displacementMapUrl}" result="displacementMap" />
            ${blurAmount > 0 ? `
            <feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmount}" result="blurred" />
            ` : ""}
            <feDisplacementMap in="${blurAmount > 0 ? "blurred" : "SourceGraphic"}" in2="displacementMap" scale="${redScale}" xChannelSelector="R" yChannelSelector="G" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedR" />
            <feDisplacementMap in="${blurAmount > 0 ? "blurred" : "SourceGraphic"}" in2="displacementMap" scale="${greenScale}" xChannelSelector="R" yChannelSelector="G" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedG" />
            <feDisplacementMap in="${blurAmount > 0 ? "blurred" : "SourceGraphic"}" in2="displacementMap" scale="${blueScale}" xChannelSelector="R" yChannelSelector="G" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="displacedB" />
            <feBlend in="displacedR" in2="displacedG" mode="screen" result="RG"/>
            <feBlend in="RG" in2="displacedB" mode="screen"/>
        </filter>
    </defs>
</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svgContent) + "#fisheye";
  }

  static apply(element: HTMLElement, options: FisheyeOptions): HTMLElement {
    const { size, width, height, borderRadius, distortion = 1.5, edgeSoftness = 0.2, chromaticAberration = 5, blurAmount = 0, debug = false } = options;
    const { width: resolvedWidth, height: resolvedHeight, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });
    setBaseLensStyles(element, {
      width: resolvedWidth,
      height: resolvedHeight,
      borderRadiusCss,
      background: "rgba(0, 0, 0, 0.05)",
      border: "3px solid rgba(255, 255, 255, 0.4)",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)",
    });
    if (debug) {
      const displacementMap = this.createDisplacementMap({ size, width, height, borderRadius, distortion, edgeSoftness });
      applyDebugDisplacementBackground(element, displacementMap);
    } else {
      const filter = this.createFilter({ size, width, height, borderRadius, distortion, edgeSoftness, chromaticAberration, blurAmount });
      applyBackdropFilterCss(element, `url('${filter}') brightness(1.05)`);
    }
    return element;
  }

  static createDraggable(options: FisheyeOptions): HTMLElement {
    const { initialX = 100, initialY = 100, className = "" } = options;
    const element = document.createElement("div");
    if (className) element.className = className;
    this.apply(element, options);
    makeDraggable(element, initialX, initialY);
    return element;
  }
}


