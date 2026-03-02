import { resolveLensMetrics, setBaseLensStyles, applyDebugDisplacementBackground, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface PrismGridOptions extends ResolveLensMetricsOptions {
  cellSize?: number;
  dispersion?: number;
  blurAmount?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
}

function makeGridMap(width: number, height: number, cell: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  const img = ctx.createImageData(canvas.width, canvas.height); const data = img.data;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const gx = Math.floor(x / cell); const gy = Math.floor(y / cell);
      const cx = gx * cell + cell / 2; const cy = gy * cell + cell / 2;
      const dx = x - cx; const dy = y - cy;
      const n = Math.max(-1, Math.min(1, dx / (cell / 2))); const m = Math.max(-1, Math.min(1, dy / (cell / 2)));
      const sign = (gx + gy) % 2 === 0 ? 1 : -1;
      const r = 128 + sign * n * 60; const g = 128 + sign * m * 60; const i = (y * canvas.width + x) * 4;
      data[i] = Math.max(0, Math.min(255, r)); data[i + 1] = Math.max(0, Math.min(255, g)); data[i + 2] = 128; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0); return canvas.toDataURL("image/png");
}

export class PrismGridLens {
  static createDisplacementMap({ size, width, height, borderRadius, cellSize = 40 }: Pick<PrismGridOptions, "size" | "width" | "height" | "borderRadius" | "cellSize">): string {
    const { width: w, height: h } = resolveLensMetrics({ size, width, height, borderRadius });
    const cell = Math.max(8, Math.min(200, Math.round(cellSize)));
    return makeGridMap(w, h, cell);
  }

  static createFilter({ size, width, height, borderRadius, cellSize = 40, dispersion = 10, blurAmount = 0 }: PrismGridOptions): string {
    const { width: w, height: h } = resolveLensMetrics({ size, width, height, borderRadius });
    const disp = this.createDisplacementMap({ size, width, height, borderRadius, cellSize });
    const rScale = dispersion * 1.5; const gScale = dispersion * 1.0; const bScale = dispersion * 0.5;
    const svg = `<svg height="${h}" width="${w}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="prismGrid" color-interpolation-filters="sRGB">
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
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg) + "#prismGrid";
  }

  static apply(element: HTMLElement, options: PrismGridOptions): HTMLElement {
    const { size, width, height, borderRadius, debug = false } = options;
    const { width: w, height: h, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });
    setBaseLensStyles(element, { width: w, height: h, borderRadiusCss, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.35)", boxShadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 0 18px rgba(255,255,255,0.18)" });
    if (debug) { const map = this.createDisplacementMap(options); applyDebugDisplacementBackground(element, map); return element; }
    const filter = this.createFilter(options); applyBackdropFilterCss(element, `url('${filter}') brightness(1.06)`); return element;
  }

  static createDraggable(options: PrismGridOptions): HTMLElement {
    const { initialX = 160, initialY = 160, className = "" } = options;
    const el = document.createElement("div"); if (className) el.className = className; this.apply(el, options); makeDraggable(el, initialX, initialY); return el;
  }
}


