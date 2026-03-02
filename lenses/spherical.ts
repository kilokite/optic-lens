import { EPSILON, resolveLensMetrics, computeDirectionMetrics, setBaseLensStyles, applyDebugDisplacementBackground, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface SphericalOptions extends ResolveLensMetricsOptions {
  curvature?: number;
  edgeSoftness?: number;
  chromaticAberration?: number;
  blurAmount?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
}

export class SphericalLens {
  static createDisplacementMap({
    size,
    width,
    height,
    borderRadius,
    curvature = 1.2,
    edgeSoftness = 0.25,
  }: Pick<SphericalOptions, "size" | "width" | "height" | "borderRadius" | "curvature" | "edgeSoftness">): string {
    const { width: w, height: h, borderRadius: radius } = resolveLensMetrics({ size, width, height, borderRadius });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    const halfW = canvas.width / 2; const halfH = canvas.height / 2;
    const data = ctx.createImageData(canvas.width, canvas.height); const arr = data.data;
    const k = Math.max(0, curvature); const soft = Math.max(0, Math.min(1, edgeSoftness));
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x - halfW; const dy = y - halfH; const i = (y * canvas.width + x) * 4;
        const metrics = computeDirectionMetrics(dx, dy, halfW, halfH, radius);
        const r = metrics.normalized;
        if (r >= 1 - EPSILON) { arr[i] = 128; arr[i + 1] = 128; arr[i + 2] = 128; arr[i + 3] = 255; continue; }
        const distance = Math.sqrt(dx * dx + dy * dy);
        let dispX = 0; let dispY = 0;
        if (distance > EPSILON && metrics.maxDistance > EPSILON) {
          const curve = k * Math.pow(r, 2) * (1 - r);
          const fade = soft > 0 && r > 1 - soft ? (1 - r) / soft : 1;
          const magnitude = curve * metrics.maxDistance * 1.2 * fade;
          dispX = (dx / distance) * magnitude; dispY = (dy / distance) * magnitude;
        }
        arr[i] = Math.max(0, Math.min(255, 128 + dispX * 2));
        arr[i + 1] = Math.max(0, Math.min(255, 128 + dispY * 2));
        arr[i + 2] = 128; arr[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0); return canvas.toDataURL("image/png");
  }

  static createFilter({ size, width, height, borderRadius, chromaticAberration = 3, blurAmount = 0, ...rest }: SphericalOptions): string {
    const { width: w, height: h } = resolveLensMetrics({ size, width, height, borderRadius });
    const disp = this.createDisplacementMap({ size, width, height, borderRadius, ...rest });
    const base = Math.max(w, h) * 0.5;
    const rScale = base + chromaticAberration * 2; const gScale = base + chromaticAberration; const bScale = base;
    const svg = `<svg height="${h}" width="${w}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="spherical" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" height="${h}" width="${w}" href="${disp}" result="map" />
      ${blurAmount > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmount}" result="blur" />` : ""}
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${rScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="R"/>
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${gScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="G"/>
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${bScale}" xChannelSelector="R" yChannelSelector="G" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="B"/>
      <feBlend in="R" in2="G" mode="screen" result="RG"/>
      <feBlend in="RG" in2="B" mode="screen"/>
    </filter>
  </defs>
</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg) + "#spherical";
  }

  static apply(element: HTMLElement, options: SphericalOptions): HTMLElement {
    const { size, width, height, borderRadius, debug = false } = options;
    const { width: w, height: h, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });
    setBaseLensStyles(element, { width: w, height: h, borderRadiusCss, background: "radial-gradient(circle at center, rgba(255,255,255,0.10), rgba(0,0,0,0.15))", border: "2px solid rgba(255,255,255,0.35)", boxShadow: "0 10px 34px rgba(0,0,0,0.32), inset 0 0 22px rgba(255,255,255,0.16)" });
    if (debug) { const map = this.createDisplacementMap(options); applyDebugDisplacementBackground(element, map); return element; }
    const filter = this.createFilter(options); applyBackdropFilterCss(element, `url('${filter}') brightness(1.06)`); return element;
  }

  static createDraggable(options: SphericalOptions): HTMLElement {
    const { initialX = 110, initialY = 110, className = "" } = options;
    const el = document.createElement("div"); if (className) el.className = className; this.apply(el, options); makeDraggable(el, initialX, initialY); return el;
  }
}


