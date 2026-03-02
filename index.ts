/**
 * @filter - Lens Effect Filters
 * Lens effect filter library
 */

//base utilities
export * from "./lensUtils.js";

//lens filter classes and types
import { Glass } from "./lenses/glass.js";
import { FisheyeLens } from "./lenses/fisheye.js";
import { KaleidoscopeLens } from "./lenses/kaleidoscope.js";
import { ReadingGlass } from "./lenses/readingGlass.js";
import { CylindricalLens } from "./lenses/cylindrical.js";
import { SphericalLens } from "./lenses/spherical.js";
import { PrismLens } from "./lenses/prism.js";
import { PrismGridLens } from "./lenses/prismGrid.js";
import { RandomLens } from "./lenses/random.js";

export { Glass, FisheyeLens, KaleidoscopeLens, ReadingGlass, CylindricalLens, SphericalLens, PrismLens, PrismGridLens, RandomLens };

//types
export type { GlassOptions } from "./lenses/glass.js";
export type { FisheyeOptions } from "./lenses/fisheye.js";
export type { KaleidoscopeOptions } from "./lenses/kaleidoscope.js";
export type { ReadingGlassOptions } from "./lenses/readingGlass.js";
export type { CylindricalOptions } from "./lenses/cylindrical.js";
export type { SphericalOptions } from "./lenses/spherical.js";
export type { PrismOptions } from "./lenses/prism.js";
export type { PrismGridOptions } from "./lenses/prismGrid.js";
export type { RandomOptions } from "./lenses/random.js";

// TODO: other lens types
// import { ReadingGlass } from "./reading-glass";
// export { ReadingGlass };
// export type { ReadingGlassOptions } from "./reading-glass";
// import { CylindricalLens } from "./cylindrical";
// export { CylindricalLens };
// export type { CylindricalOptions } from "./cylindrical";
// import { SphericalLens } from "./spherical";
// export { SphericalLens };
// export type { SphericalOptions } from "./spherical";
// import { PrismLens } from "./prism";
// export { PrismLens };
// export type { PrismOptions } from "./prism";
// import { PrismGridLens } from "./prism-grid";
// export { PrismGridLens };
// export type { PrismGridOptions } from "./prism-grid";
// import { RandomLens } from "./random";
// export { RandomLens };
// export type { RandomOptions } from "./random";

/**
 * Lens filter collection
 */
export const LensFilters = {
  Glass,
  FisheyeLens,
  KaleidoscopeLens,
  ReadingGlass,
  CylindricalLens,
  SphericalLens,
  PrismLens,
  PrismGridLens,
  RandomLens,
};

/**
 * Default export
 */
export default LensFilters;

