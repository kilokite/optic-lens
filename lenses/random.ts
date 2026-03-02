import { resolveLensMetrics, setBaseLensStyles, applyDebugDisplacementBackground, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface RandomOptions extends ResolveLensMetricsOptions {
  intensity?: number;
  grain?: number;
  blurAmount?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
}

function makeNoiseMap(width: number, height: number, intensity: number, grain: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  const img = ctx.createImageData(canvas.width, canvas.height); const data = img.data; const step = Math.max(1, Math.round(grain));
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (x % step === 0 && y % step === 0) {
        const rx = (Math.random() * 2 - 1) * 127 * intensity;
        const ry = (Math.random() * 2 - 1) * 127 * intensity;
        for (let yy = 0; yy < step && y + yy < canvas.height; yy++) {
          for (let xx = 0; xx < step && x + xx < canvas.width; xx++) {
            const j = ((y + yy) * canvas.width + (x + xx)) * 4;
            data[j] = Math.max(0, Math.min(255, 128 + rx));
            data[j + 1] = Math.max(0, Math.min(255, 128 + ry));
            data[j + 2] = 128; data[j + 3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0); return canvas.toDataURL("image/png");
}

export class RandomLens {
  static createDisplacementMap({ size, width, height, borderRadius, intensity = 0.5, grain = 4 }: Pick<RandomOptions, "size" | "width" | "height" | "borderRadius" | "intensity" | "grain">): string {
    const { width: w, height: h } = resolveLensMetrics({ size, width, height, borderRadius });
    return makeNoiseMap(w, h, Math.max(0, Math.min(1, intensity)), grain);
  }

  static createFilter({ size, width, height, borderRadius, intensity = 0.5, grain = 4, blurAmount = 0 }: RandomOptions): string {
    const { width: w, height: h } = resolveLensMetrics({ size, width, height, borderRadius });
    const disp = this.createDisplacementMap({ size, width, height, borderRadius, intensity, grain });
    const base = Math.max(w, h) * 0.4 * (0.5 + intensity);
    const svg = `<svg height="${h}" width="${w}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="randomLens" color-interpolation-filters="sRGB">
      <feImage x="0" y="0" height="${h}" width="${w}" href="${disp}" result="map" />
      ${blurAmount > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${blurAmount}" result="blur" />` : ""}
      <feDisplacementMap in="${blurAmount > 0 ? "blur" : "SourceGraphic"}" in2="map" scale="${base}" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg) + "#randomLens";
  }

  static apply(element: HTMLElement, options: RandomOptions): HTMLElement {
    const { size, width, height, borderRadius, debug = false } = options;
    const { width: w, height: h, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });
    setBaseLensStyles(element, { width: w, height: h, borderRadiusCss, background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.28)", boxShadow: "0 8px 26px rgba(0,0,0,0.26), inset 0 0 14px rgba(255,255,255,0.14)" });
    if (debug) { const map = this.createDisplacementMap(options); applyDebugDisplacementBackground(element, map); return element; }
    const filter = this.createFilter(options); applyBackdropFilterCss(element, `url('${filter}') brightness(1.02)`); return element;
  }

  static createDraggable(options: RandomOptions): HTMLElement {
    const { initialX = 60, initialY = 60, className = "" } = options;
    const el = document.createElement("div"); if (className) el.className = className; this.apply(el, options); makeDraggable(el, initialX, initialY); return el;
  }
}


