import { EPSILON, resolveLensMetrics, computeDirectionMetrics, setBaseLensStyles, applyDebugDisplacementBackground, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface ReadingGlassOptions extends ResolveLensMetricsOptions {
  magnification?: number;
  edgeSoftness?: number;
  chromaticAberration?: number;
  blurAmount?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
}

export class ReadingGlass {
  static createDisplacementMap({
    size,
    width,
    height,
    borderRadius,
    magnification = 1.5,
    edgeSoftness = 0.25,
  }: Pick<ReadingGlassOptions, "size" | "width" | "height" | "borderRadius" | "magnification" | "edgeSoftness">): string {
    const { width: w, height: h, borderRadius: radius } = resolveLensMetrics({ size, width, height, borderRadius });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    const halfW = canvas.width / 2; const halfH = canvas.height / 2;
    const data = ctx.createImageData(canvas.width, canvas.height); const arr = data.data;
    const soft = Math.max(0, Math.min(1, edgeSoftness));
    const mag = Math.max(1, Math.min(3, magnification));
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x - halfW; const dy = y - halfH; const i = (y * canvas.width + x) * 4;
        const metrics = computeDirectionMetrics(dx, dy, halfW, halfH, radius);
        const r = metrics.normalized;
        if (r >= 1 - EPSILON) { arr[i] = 128; arr[i + 1] = 128; arr[i + 2] = 128; arr[i + 3] = 255; continue; }
        const distance = Math.sqrt(dx * dx + dy * dy);
        let dispX = 0; let dispY = 0;
        if (distance > EPSILON && r < 1 && metrics.maxDistance > EPSILON) {
          // Use displacement calculation consistent with root version: -(1 - 1/m) * r
          const displacementFactor = -(1 - 1 / mag) * r;
          let finalFactor = displacementFactor;
          if (soft > 0 && r > 1 - soft) {
            const edgeFade = (1 - r) / soft;
            const faded = Math.max(0, Math.min(1, edgeFade));
            finalFactor *= faded;
          }
          const magnitude = finalFactor * metrics.maxDistance;
          dispX = (dx / distance) * magnitude;
          dispY = (dy / distance) * magnitude;
        }
        arr[i] = Math.max(0, Math.min(255, 128 + dispX * 2));
        arr[i + 1] = Math.max(0, Math.min(255, 128 + dispY * 2));
        arr[i + 2] = 128; arr[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0); return canvas.toDataURL("image/png");
  }

  static createFilter({
    size,
    width,
    height,
    borderRadius,
    magnification = 1.5,
    edgeSoftness = 0.25,
    chromaticAberration = 5,
    blurAmount = 1,
  }: ReadingGlassOptions): string {
    const { width: w, height: h } = resolveLensMetrics({ size, width, height, borderRadius });
    const disp = this.createDisplacementMap({ size, width, height, borderRadius, magnification, edgeSoftness });
    const baseDimension = Math.max(w, h);
    const baseScale = baseDimension * 0.5;
    const redScale = baseScale + chromaticAberration * 2;
    const greenScale = baseScale + chromaticAberration;
    const blueScale = baseScale;
    const svg = `<svg height="${h}" width="${w}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="readingGlass" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" height="${h}" width="${w}" href="${disp}" result="map" />
      ${blurAmount > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmount}" result="blur" />` : ""}
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${redScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedR" />
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${greenScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedG" />
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${blueScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="displacedB" />
      <feBlend in="displacedR" in2="displacedG" mode="screen" result="RG"/>
      <feBlend in="RG" in2="displacedB" mode="screen"/>
    </filter>
  </defs>
</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg) + "#readingGlass";
  }

  static apply(element: HTMLElement, options: ReadingGlassOptions): HTMLElement {
    const { size, width, height, borderRadius, debug = false } = options;
    const { width: w, height: h, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });
    setBaseLensStyles(element, { width: w, height: h, borderRadiusCss, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.35)", boxShadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 0 18px rgba(255,255,255,0.18)" });
    if (debug) { const map = this.createDisplacementMap(options); applyDebugDisplacementBackground(element, map); return element; }
    const filter = this.createFilter(options);
    applyBackdropFilterCss(element, `blur(0px) url('${filter}') brightness(1.05)`);
    return element;
  }

  static createDraggable(options: ReadingGlassOptions): HTMLElement {
    const { initialX = 80, initialY = 80, className = "" } = options;
    const el = document.createElement("div");
    if (className) el.className = className;
    this.apply(el, options);
    makeDraggable(el, initialX, initialY);
    return el;
  }
}


