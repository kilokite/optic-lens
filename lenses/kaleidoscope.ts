import {
  EPSILON,
  resolveLensMetrics,
  computeDirectionMetrics,
  normalizedToReal,
  setBaseLensStyles,
  applyDebugDisplacementBackground,
  applyBackdropFilterCss,
  makeDraggable,
} from "../lensUtils.js";

const TAU = Math.PI * 2;

interface ResolveLensMetricsOptions {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
}

export interface KaleidoscopeOptions extends ResolveLensMetricsOptions {
  structure?: "triangular" | "two-mirror" | "four-mirror" | "conical" | "loop";
  angle?: number;
  segments?: number;
  radialSegments?: number;
  radialBlend?: number;
  radialCurve?: number;
  angularWarp?: number;
  angularWarpFrequency?: number;
  intensity?: number;
  mirrorCurve?: number;
  fourMirrorLayout?: "square" | "diamond";
  fourMirrorFocus?: number;
  fourMirrorTwist?: number;
  fourMirrorWarp?: number;
  conicalMirrors?: number;
  conicalCurve?: number;
  tunnelDepth?: number;
  tunnelTwist?: number;
  loopFocus?: number;
  rotation?: number;
  edgeSoftness?: number;
  chromaticAberration?: number;
  blurAmount?: number;
  debug?: boolean;
  className?: string;
  initialX?: number;
  initialY?: number;
  autoRotate?: boolean;
  rotationSpeed?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number): number {
  const mod = angle % TAU;
  return mod < 0 ? mod + TAU : mod;
}

function edgeFadeRatio(value: number): number {
  return clamp(1 - value, 0, 1);
}

function safeEdgeFade(normalizedDist: number, edgeSoftness: number): number {
  if (edgeSoftness <= EPSILON) {
    return normalizedDist >= 1 ? 0 : 1;
  }
  if (normalizedDist > 1 - edgeSoftness) {
    return clamp((1 - normalizedDist) / edgeSoftness, 0, 1);
  }
  return 1;
}

function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

interface RadialFoldResult {
  value: number;
  tileIndex: number;
  fraction: number;
}

function foldRadial(radius: number, repeats: number, blend: number): RadialFoldResult {
  const clampedRadius = clamp(radius, 0, 1 - 1e-6);
  const reps = Math.max(1, Math.round(repeats));
  if (reps <= 1) {
    return {
      value: clampedRadius,
      tileIndex: 0,
      fraction: clampedRadius,
    };
  }
  const scaled = clampedRadius * reps;
  let tileIndex = Math.floor(scaled);
  if (tileIndex >= reps) {
    tileIndex = reps - 1;
  }
  let fraction = scaled - tileIndex;
  if (tileIndex % 2 !== 0) {
    fraction = 1 - fraction;
  }
  fraction = clamp(fraction, 0, 1);
  const blended = clamp(mix(clampedRadius, fraction, clamp(blend, 0, 1)), 0, 1);
  return {
    value: blended,
    tileIndex,
    fraction,
  };
}

function shapeRadius(radius: number, curve: number): number {
  const clamped = clamp(radius, 0, 1);
  const curveClamped = clamp(curve, 0, 1);
  const powStrength = mix(0.55, 1.85, curveClamped);
  const curved = Math.pow(clamped, powStrength);
  const blend = mix(0.45, 0.82, curveClamped);
  return clamp(mix(clamped, curved, blend), 0, 1);
}

function applyRadialTwist(
  x: number,
  y: number,
  radius: number,
  amount: number,
  frequency: number
): { x: number; y: number } {
  if (Math.abs(amount) <= EPSILON || frequency <= EPSILON) {
    return { x, y };
  }
  const clampedRadius = clamp(radius, 0, 1);
  const twist = amount * Math.sin(clampedRadius * frequency * TAU);
  if (Math.abs(twist) <= EPSILON) {
    return { x, y };
  }
  const cosT = Math.cos(twist);
  const sinT = Math.sin(twist);
  return {
    x: x * cosT - y * sinT,
    y: x * sinT + y * cosT,
  };
}

export class KaleidoscopeLens {
  static createDisplacementMap(options: KaleidoscopeOptions): string {
    const {
      size,
      width,
      height,
      borderRadius,
      structure = "triangular",
      angle = 60,
      segments,
      radialSegments,
      radialBlend,
      radialCurve,
      angularWarp,
      angularWarpFrequency,
      intensity: intensityOption,
      mirrorCurve: mirrorCurveOption,
      fourMirrorLayout = "square",
      fourMirrorFocus = fourMirrorLayout === "diamond" ? 0.28 : 0.2,
      fourMirrorTwist = 0.35,
      fourMirrorWarp = 0.3,
      conicalMirrors = 3,
      conicalCurve = 0.4,
      tunnelDepth = 0.35,
      tunnelTwist = 1.0,
      loopFocus = 0.4,
      rotation = 0,
      edgeSoftness = 0.2,
    } = options;

    const defaultIntensity =
      structure === "triangular"
        ? 1.35
        : structure === "two-mirror"
        ? 1.15
        : structure === "four-mirror"
        ? 1.25
        : structure === "conical"
        ? 1.1
        : structure === "loop"
        ? 1.05
        : 1;
    const intensity = clamp(intensityOption ?? defaultIntensity, 0.2, 3);

    const defaultMirrorCurve =
      structure === "triangular"
        ? 1.65
        : structure === "two-mirror"
        ? 1.35
        : structure === "four-mirror"
        ? 1.4
        : 1.1;
    const mirrorCurveValue = clamp(mirrorCurveOption ?? defaultMirrorCurve, 0.3, 3);

    const triangularParams =
      structure === "triangular" || structure === "two-mirror"
        ? (() => {
            const baseAngle = clamp(Math.abs(angle), 5, 180);
            const minSections = structure === "triangular" ? 3 : 2;
            const desiredSections =
              segments != null ? Math.round(segments) : Math.round(360 / baseAngle);
            const sections = clamp(desiredSections, minSections, 64);
            const sectionAngle = TAU / sections;
            const defaultRadialSegments =
              radialSegments != null
                ? radialSegments
                : structure === "triangular"
                ? Math.max(4, Math.round(sections / 1.5))
                : Math.max(2, Math.round(sections / 2));
            const radialRepeats = clamp(Math.round(defaultRadialSegments), 1, 16);
            const computedRadialBlend =
              radialBlend ?? (structure === "triangular" ? 0.72 : 0.58);
            const computedRadialCurve =
              radialCurve ?? (structure === "triangular" ? 0.6 : 0.45);
            const computedAngularWarp =
              angularWarp ?? (structure === "triangular" ? 0.28 : 0.18);
            const computedAngularFrequency =
              angularWarpFrequency ??
              (structure === "triangular"
                ? Math.max(2.5, sections * 0.85)
                : Math.max(1.5, sections * 0.65));
            return {
              sections,
              sectionAngle,
              radialRepeats,
              radialBlend: clamp(computedRadialBlend, 0, 1),
              radialCurve: clamp(computedRadialCurve, 0, 1),
              angularWarp: clamp(computedAngularWarp, -Math.PI, Math.PI),
              angularFrequency: Math.max(0, computedAngularFrequency),
            };
          })()
        : null;

    const fourMirrorParams =
      structure === "four-mirror"
        ? {
            radialRepeats: clamp(Math.round(radialSegments ?? 4), 1, 16),
            radialBlend: clamp(radialBlend ?? 0.65, 0, 1),
            radialCurve: clamp(radialCurve ?? 0.5, 0, 1),
            focus: clamp(fourMirrorFocus, 0, 0.6),
            twist: clamp(fourMirrorTwist, -3, 3),
            warp: clamp(fourMirrorWarp, 0, 1),
          }
        : null;

    const { width: resolvedWidth, height: resolvedHeight, borderRadius: resolvedRadius } =
      resolveLensMetrics({ size, width, height, borderRadius });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(resolvedWidth);
    canvas.height = Math.round(resolvedHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    const rotationRad = (rotation * Math.PI) / 180;
    const loopFocusValue = clamp(loopFocus, 0.1, 2.5);

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

        const distance = Math.sqrt(dx * dx + dy * dy);
        let unitX = 0;
        let unitY = 0;
        if (distance > EPSILON) {
          unitX = dx / distance;
          unitY = dy / distance;
        }
        const normX = unitX * normalizedDist;
        const normY = unitY * normalizedDist;
        const theta = Math.atan2(normY, normX);

        let displacementX = 0;
        let displacementY = 0;

        if (triangularParams) {
          const {
            sectionAngle,
            radialRepeats,
            radialBlend: triBlend,
            radialCurve: triCurve,
            angularWarp: triWarp,
            angularFrequency: triFrequency,
          } = triangularParams;

          let adjustedAngle = normalizeAngle(theta - rotationRad);
          const baseIndex = Math.floor(adjustedAngle / sectionAngle);
          let angleInSection = adjustedAngle - baseIndex * sectionAngle;
          if (angleInSection > sectionAngle / 2) {
            angleInSection = sectionAngle - angleInSection;
          }

          const folded = foldRadial(normalizedDist, radialRepeats, triBlend);
          const shapedRadius = shapeRadius(folded.value, triCurve);
          const baseAngle = baseIndex * sectionAngle + angleInSection + rotationRad;
          let mappedNormX = Math.cos(baseAngle) * shapedRadius;
          let mappedNormY = Math.sin(baseAngle) * shapedRadius;
          ({ x: mappedNormX, y: mappedNormY } = applyRadialTwist(
            mappedNormX,
            mappedNormY,
            folded.value,
            triWarp,
            triFrequency
          ));
          const mappedReal = normalizedToReal(
            mappedNormX,
            mappedNormY,
            halfWidth,
            halfHeight,
            resolvedRadius
          );
          const edgeRatioDenominator = sectionAngle / 2;
          const edgeRatio =
            edgeRatioDenominator > EPSILON ? angleInSection / edgeRatioDenominator : 0;
          const edgeFade = Math.pow(edgeFadeRatio(edgeRatio), mirrorCurveValue);
          const radialFadeBase =
            normalizedDist > 1 - edgeSoftness
              ? (1 - normalizedDist) / edgeSoftness
              : 1;
          const radialStrength = 0.7 + 0.4 * (1 - triCurve);
          const radialFade = Math.pow(clamp(radialFadeBase, 0, 1), radialStrength);
          displacementX = (mappedReal.x - dx) * radialFade * edgeFade;
          displacementY = (mappedReal.y - dy) * radialFade * edgeFade;
        } else if (fourMirrorParams) {
          const {
            radialRepeats,
            radialBlend: fmBlend,
            radialCurve: fmCurve,
            focus,
            twist,
            warp,
          } = fourMirrorParams;

          const folded = foldRadial(normalizedDist, radialRepeats, fmBlend);
          const shapedRadius = shapeRadius(folded.value, fmCurve);
          const cosR = Math.cos(rotationRad);
          const sinR = Math.sin(rotationRad);
          let rotX = normX * cosR - normY * sinR;
          let rotY = normX * sinR + normY * cosR;
          const twistFrequency = Math.max(1.2, radialRepeats * 0.8);
          ({ x: rotX, y: rotY } = applyRadialTwist(rotX, rotY, folded.value, twist, twistFrequency));

          if (fourMirrorLayout === "diamond") {
            const cos45 = Math.SQRT1_2;
            const sin45 = Math.SQRT1_2;
            const dxRot = rotX * cos45 - rotY * sin45;
            const dyRot = rotX * sin45 + rotY * cos45;
            const mx = Math.abs(dxRot);
            const my = Math.abs(dyRot);
            rotX = mx * cos45 + my * sin45;
            rotY = -mx * sin45 + my * cos45;
          } else {
            rotX = Math.abs(rotX);
            rotY = Math.abs(rotY);
          }

          const focusAdjust = 1 - focus * Math.pow(folded.value, 1.35);
          rotX *= focusAdjust;
          rotY *= focusAdjust;

          if (warp > EPSILON) {
            const warpScale = 1 - warp * Math.pow(folded.value, 1.2);
            rotX *= warpScale;
            rotY *= warpScale;
          }

          const length = Math.hypot(rotX, rotY);
          if (length > EPSILON) {
            const scale = shapedRadius / length;
            rotX *= scale;
            rotY *= scale;
          } else {
            rotX = 0;
            rotY = 0;
          }

          const mappedNormX = rotX * cosR + rotY * sinR;
          const mappedNormY = -rotX * sinR + rotY * cosR;
          const mappedReal = normalizedToReal(
            mappedNormX,
            mappedNormY,
            halfWidth,
            halfHeight,
            resolvedRadius
          );
          const radialFadeBase =
            normalizedDist > 1 - edgeSoftness
              ? (1 - normalizedDist) / edgeSoftness
              : 1;
          const radialStrength = 0.72 + 0.35 * (1 - fmCurve);
          const radialFade = Math.pow(clamp(radialFadeBase, 0, 1), radialStrength);
          const edgeFade = Math.pow(edgeFadeRatio(folded.fraction), mirrorCurveValue);
          displacementX = (mappedReal.x - dx) * radialFade * edgeFade;
          displacementY = (mappedReal.y - dy) * radialFade * edgeFade;
        } else if (structure === "conical") {
          const mirrorCount = clamp(Math.round(conicalMirrors), 3, 8);
          const sectionAngle = TAU / mirrorCount;
          let adjustedAngle = normalizeAngle(theta);
          const baseIndex = Math.floor(adjustedAngle / sectionAngle);
          let angleInSection = adjustedAngle - baseIndex * sectionAngle;
          if (angleInSection > sectionAngle / 2) {
            angleInSection = sectionAngle - angleInSection;
          }
          const swirl = conicalCurve * 0.6 * Math.pow(normalizedDist, 1.4);
          const finalAngle = baseIndex * sectionAngle + angleInSection + swirl;
          const bulge = 1 - conicalCurve * 0.6 + conicalCurve * Math.pow(normalizedDist, 1.1);
          const finalRadius = clamp(normalizedDist * bulge, 0, 1);
          const mappedNormX = Math.cos(finalAngle) * finalRadius;
          const mappedNormY = Math.sin(finalAngle) * finalRadius;
          const mappedReal = normalizedToReal(
            mappedNormX,
            mappedNormY,
            halfWidth,
            halfHeight,
            resolvedRadius
          );
          const radialFade =
            normalizedDist > 1 - edgeSoftness
              ? (1 - normalizedDist) / edgeSoftness
              : 1;
          displacementX = (mappedReal.x - dx) * radialFade;
          displacementY = (mappedReal.y - dy) * radialFade;
        } else if (structure === "loop") {
          const depth = clamp(tunnelDepth, 0, 1);
          const twist = tunnelTwist;
          const spiralAngle = theta + twist * Math.pow(normalizedDist, 1.6) * TAU;
          const tunnelRadius =
            Math.pow(normalizedDist, 0.55) * (1 - depth) + depth * Math.pow(normalizedDist, 1.3);
          const mappedNormX = Math.cos(spiralAngle + rotationRad) * tunnelRadius;
          const mappedNormY = Math.sin(spiralAngle + rotationRad) * tunnelRadius;
          const mappedReal = normalizedToReal(
            mappedNormX,
            mappedNormY,
            halfWidth,
            halfHeight,
            resolvedRadius
          );
          const radialFade = Math.pow(edgeFadeRatio(normalizedDist), loopFocusValue);
          displacementX = (mappedReal.x - dx) * radialFade;
          displacementY = (mappedReal.y - dy) * radialFade;
        }

        const fade = safeEdgeFade(normalizedDist, edgeSoftness);
        const scaledX = displacementX * intensity;
        const scaledY = displacementY * intensity;
        data[idx] = clamp(128 + scaledX * 2 * fade, 0, 255);
        data[idx + 1] = clamp(128 + scaledY * 2 * fade, 0, 255);
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  static createFilter(options: KaleidoscopeOptions): string {
    const { size, width, height, borderRadius, chromaticAberration = 3, blurAmount = 0 } = options;
    const { width: resolvedWidth, height: resolvedHeight } = resolveLensMetrics({ size, width, height, borderRadius });
    const displacementMapUrl = this.createDisplacementMap(options);
    const baseScale = Math.max(resolvedWidth, resolvedHeight) * 0.5;
    const redScale = baseScale + chromaticAberration * 2.2;
    const greenScale = baseScale + chromaticAberration;
    const blueScale = baseScale - chromaticAberration * 0.5;
    const svgContent = `<svg height="${resolvedHeight}" width="${resolvedWidth}" viewBox="0 0 ${resolvedWidth} ${resolvedHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="kaleidoscope" color-interpolation-filters="sRGB">
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
    return "data:image/svg+xml;utf8," + encodeURIComponent(svgContent) + "#kaleidoscope";
  }

  static apply(element: HTMLElement, options: KaleidoscopeOptions): HTMLElement {
    const { size, width, height, borderRadius, debug = false, chromaticAberration = 3, blurAmount = 0 } = options;
    const { width: resolvedWidth, height: resolvedHeight, borderRadiusCss } = resolveLensMetrics({ size, width, height, borderRadius });
    setBaseLensStyles(element, {
      width: resolvedWidth,
      height: resolvedHeight,
      borderRadiusCss,
      background: "radial-gradient(circle at center, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.15))",
      border: "2px solid rgba(255, 255, 255, 0.35)",
      boxShadow: `0 12px 40px rgba(0, 0, 0, 0.35), inset 0 0 24px rgba(255, 255, 255, 0.18)`,
    });
    if (debug) {
      const displacementMap = this.createDisplacementMap(options);
      applyDebugDisplacementBackground(element, displacementMap);
      return element;
    }
    const filter = this.createFilter({ ...options, chromaticAberration, blurAmount });
    applyBackdropFilterCss(element, `url('${filter}') brightness(1.08) saturate(1.25)`);
    return element;
  }

  static createDraggable(options: KaleidoscopeOptions): HTMLElement {
    const { initialX = 120, initialY = 120, className = "", autoRotate = false, rotationSpeed = 1 } = options;
    const element = document.createElement("div");
    if (className) {
      element.className = className;
    }
    this.apply(element, options);
    makeDraggable(element, initialX, initialY);

    let rotateInterval: any = null;
    if (autoRotate && !options.debug) {
      let currentRotation = options.rotation || 0;
      const speedPerFrame = rotationSpeed / 60;
      rotateInterval = setInterval(() => {
        currentRotation += speedPerFrame;
        if (currentRotation >= 360) {
          currentRotation -= 360;
        }
        const filter = this.createFilter({ ...options, rotation: currentRotation });
        applyBackdropFilterCss(element, `url('${filter}') brightness(1.08) saturate(1.25)`);
      }, 1000 / 60);
    }

    (element as any)._cleanup = () => {
      if (rotateInterval) {
        clearInterval(rotateInterval);
      }
    };
    return element;
  }
}

