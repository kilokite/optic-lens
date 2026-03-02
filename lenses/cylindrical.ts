import { EPSILON, resolveLensMetrics, computeDirectionMetrics, setBaseLensStyles, applyDebugDisplacementBackground, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface CylindricalOptions extends ResolveLensMetricsOptions {
  axis?: "horizontal" | "vertical";
  curvature?: number;
  edgeSoftness?: number;
  blurAmount?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
}

export class CylindricalLens {
  static createDisplacementMap({
    size,
    width,
    height,
    borderRadius,
    axis = "horizontal",
    curvature = 1.0,
    edgeSoftness = 0.2,
  }: Pick<CylindricalOptions, "size" | "width" | "height" | "borderRadius" | "axis" | "curvature" | "edgeSoftness">): string {
    const { width: w, height: h, borderRadius: radius } = resolveLensMetrics({ size, width, height, borderRadius });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    const halfW = canvas.width / 2; const halfH = canvas.height / 2;
    const data = ctx.createImageData(canvas.width, canvas.height); const arr = data.data;
    const soft = Math.max(0, Math.min(1, edgeSoftness));
    const k = Math.max(0, curvature);
    const isHorizontal = axis === "horizontal";
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x - halfW; const dy = y - halfH; const i = (y * canvas.width + x) * 4;
        const metrics = computeDirectionMetrics(dx, dy, halfW, halfH, radius);
        const r = metrics.normalized;
        if (r >= 1 - EPSILON) { arr[i] = 128; arr[i + 1] = 128; arr[i + 2] = 128; arr[i + 3] = 255; continue; }
        const fade = soft > 0 && r > 1 - soft ? (1 - r) / soft : 1;
        let dispX = 0; let dispY = 0;
        if (isHorizontal) {
          const t = dx / (halfW + EPSILON);
          const curve = k * t * t;
          dispX = Math.sign(dx) * curve * metrics.maxDistance * 0.5 * fade;
        } else {
          const t = dy / (halfH + EPSILON);
          const curve = k * t * t;
          dispY = Math.sign(dy) * curve * metrics.maxDistance * 0.5 * fade;
        }
        arr[i] = Math.max(0, Math.min(255, 128 + dispX * 2));
        arr[i + 1] = Math.max(0, Math.min(255, 128 + dispY * 2));
        arr[i + 2] = 128; arr[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0); return canvas.toDataURL("image/png");
  }

  static createFilter(options: CylindricalOptions): string {
    const { size, width, height, borderRadius, blurAmount = 0 } = options;
    const { width: w, height: h } = resolveLensMetrics({ size, width, height, borderRadius });
    const disp = this.createDisplacementMap(options);
    const base = Math.max(w, h) * 0.45;
    const svg = `<svg height="${h}" width="${w}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="cylindrical" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" height="${h}" width="${w}" href="${disp}" result="map" />
      ${blurAmount > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmount}" result="blur" />` : ""}
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${base}" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg) + "#cylindrical";
  }

  static apply(element: HTMLElement, options: CylindricalOptions): HTMLElement {
    const { size, width, height, borderRadius, debug = false } = options;
    const { width: w, height: h, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });
    setBaseLensStyles(element, { width: w, height: h, borderRadiusCss, background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.3)", boxShadow: "0 8px 30px rgba(0,0,0,0.3), inset 0 0 18px rgba(255,255,255,0.14)" });
    if (debug) { const map = this.createDisplacementMap(options); applyDebugDisplacementBackground(element, map); return element; }
    const filter = this.createFilter(options);
    applyBackdropFilterCss(element, `url('${filter}') brightness(1.04)`);
    return element;
  }

  static createDraggable(options: CylindricalOptions): HTMLElement {
    const { initialX = 100, initialY = 100, className = "" } = options;
    const el = document.createElement("div");
    if (className) el.className = className;
    this.apply(el, options);
    makeDraggable(el, initialX, initialY);
    return el;
  }
}


