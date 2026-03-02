/**
 * Glass Filter
 */

import { setBaseLensStyles, applyBackdropFilterCss, makeDraggable } from "../lensUtils.js";

export interface GlassOptions {
  height: number;
  width: number;
  radius: number;
  depth: number;
  strength?: number;
  chromaticAberration?: number;
  blur?: number;
  debug?: boolean;
  className?: string;
}

export class Glass {
  static createDisplacementMap({
    height,
    width,
    radius,
    depth,
  }: Pick<GlassOptions, "height" | "width" | "radius" | "depth">): string {
    const scale = 0.3;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) {
      (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: ImageSmoothingQuality }).imageSmoothingQuality = "high";
    }

    ctx.scale(scale, scale);
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#000080";
    ctx.fillRect(0, 0, width, height);

    const yStartPercent = Math.min(100, Math.max(0, Math.ceil((radius / height) * 15)));
    const yEndPercent = Math.max(yStartPercent, Math.min(100, Math.floor(100 - (radius / height) * 15)));
    const yStart = (yStartPercent / 100) * height;
    const yEnd = yEndPercent === yStartPercent ? height : (yEndPercent / 100) * height;
    const gradientY = ctx.createLinearGradient(0, yStart, 0, yEnd);
    gradientY.addColorStop(0, "#00FF00");
    gradientY.addColorStop(0.2, "#00CC00");
    gradientY.addColorStop(0.4, "#009900");
    gradientY.addColorStop(0.6, "#006600");
    gradientY.addColorStop(0.8, "#003300");
    gradientY.addColorStop(1, "#000000");

    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradientY;
    ctx.fillRect(0, 0, width, height);

    const xStartPercent = Math.min(100, Math.max(0, Math.ceil((radius / width) * 15)));
    const xEndPercent = Math.max(xStartPercent, Math.min(100, Math.floor(100 - (radius / width) * 15)));
    const xStart = (xStartPercent / 100) * width;
    const xEnd = xEndPercent === xStartPercent ? width : (xEndPercent / 100) * width;
    const gradientX = ctx.createLinearGradient(xStart, 0, xEnd, 0);
    gradientX.addColorStop(0, "#FF0000");
    gradientX.addColorStop(0.2, "#CC0000");
    gradientX.addColorStop(0.4, "#990000");
    gradientX.addColorStop(0.6, "#660000");
    gradientX.addColorStop(0.8, "#330000");
    gradientX.addColorStop(1, "#000000");

    ctx.fillStyle = gradientX;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#808080";
    const blurRadius = Math.max(depth * 0.5, 0);

    if (blurRadius > 0 && "filter" in ctx) {
      ctx.save();
      (ctx as CanvasRenderingContext2D & { filter: string }).filter = `blur(${blurRadius}px)`;
      ctx.globalAlpha = 0.9;
      roundRect(ctx, depth, depth, width - 2 * depth, height - 2 * depth, radius);
      ctx.fill();
      ctx.restore();
    } else {
      const blurAmount = depth * 3;
      const blurSteps = 24;

      for (let i = 0; i < blurSteps; i++) {
        const offset = (i - blurSteps / 2) * (blurAmount / blurSteps);
        const normalizedPos = i / blurSteps - 0.5;
        const alpha = 0.18 * Math.exp(-normalizedPos * normalizedPos * 8);
        ctx.globalAlpha = alpha;
        roundRect(ctx, depth + offset, depth + offset, width - 2 * depth, height - 2 * depth, radius);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1.0;
    return canvas.toDataURL("image/png");
  }

  static createFilter({
    height,
    width,
    radius,
    depth,
    strength = 100,
    chromaticAberration = 0,
  }: Pick<
    GlassOptions,
    "height" | "width" | "radius" | "depth" | "strength" | "chromaticAberration"
  >): string {
    const displacementMapUrl = this.createDisplacementMap({ height, width, radius, depth });
    const svgContent = `<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="displace" color-interpolation-filters="sRGB">
            <feImage x="0" y="0" height="${height}" width="${width}" href="${displacementMapUrl}" result="displacementMap" />
            <feDisplacementMap transform-origin="center" in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration * 2}" xChannelSelector="R" yChannelSelector="G" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedR" />
            <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration}" xChannelSelector="R" yChannelSelector="G" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedG" />
            <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength}" xChannelSelector="R" yChannelSelector="G" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="displacedB" />
            <feBlend in="displacedR" in2="displacedG" mode="screen"/>
            <feBlend in2="displacedB" mode="screen"/>
        </filter>
    </defs>
</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svgContent) + "#displace";
  }

  static apply(element: HTMLElement, options: GlassOptions): HTMLElement {
    const { height, width, radius, depth, strength = 100, chromaticAberration = 0, blur = 2, debug = false } = options;

    setBaseLensStyles(element, {
      width,
      height,
      borderRadiusCss: `${radius}px`,
      background: "rgba(255, 255, 255, 0)",
      border: "",
      boxShadow: "inset 0 0 4px 0px white",
    });

    if (debug) {
      const displacementMap = this.createDisplacementMap({ height, width, radius, depth });
      element.style.background = `url("${displacementMap}")`;
      element.style.backgroundSize = "cover";
      element.style.boxShadow = "none";
    } else {
      const filter = this.createFilter({ height, width, radius, depth, strength, chromaticAberration });
      applyBackdropFilterCss(element, `url('${filter}') blur(${blur}px) brightness(1.1) saturate(1.5)`);
    }

    return element;
  }

  static createElement(options: GlassOptions): HTMLElement {
    const element = document.createElement("div");
    if (options.className) element.className = options.className;
    this.apply(element, options);

    let baseDepth = options.depth;
    let isClicked = false;
    element.addEventListener("mousedown", () => {
      isClicked = true;
      const newDepth = baseDepth / 0.7;
      this.apply(element, { ...options, depth: newDepth });
    });
    element.addEventListener("mouseup", () => {
      isClicked = false;
      this.apply(element, { ...options, depth: baseDepth });
    });
    element.addEventListener("mouseleave", () => {
      if (isClicked) {
        isClicked = false;
        this.apply(element, { ...options, depth: baseDepth });
      }
    });
    return element;
  }

  /**
   * Create draggable glass element
   */
  static createDraggable(options: GlassOptions & { initialX?: number; initialY?: number }): HTMLElement {
    const { initialX = 80, initialY = 80 } = options as any;
    const element = this.createElement(options);
    makeDraggable(element, initialX, initialY);
    return element;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}


