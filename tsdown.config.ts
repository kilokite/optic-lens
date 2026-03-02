import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "index.ts",
    lensUtils: "lensUtils.ts",
    "lenses/glass": "lenses/glass.ts",
    "lenses/fisheye": "lenses/fisheye.ts",
    "lenses/kaleidoscope": "lenses/kaleidoscope.ts",
    "lenses/readingGlass": "lenses/readingGlass.ts",
    "lenses/cylindrical": "lenses/cylindrical.ts",
    "lenses/spherical": "lenses/spherical.ts",
    "lenses/prism": "lenses/prism.ts",
    "lenses/prismGrid": "lenses/prismGrid.ts",
    "lenses/random": "lenses/random.ts",
  },
  format: "esm",
  outDir: "dist",
  dts: true,
  clean: true,
  platform: "neutral",
  fixedExtension: false,
});
