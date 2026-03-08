import { defineConfig } from "vite";

export default defineConfig({
    root: "libs/utils",
    build: {
        outDir: "../../dist/libs",
        emptyOutDir: false,
        lib: {
            name: "main",
            entry: "index.ts",
            formats: ["iife"],
            fileName: () => "utils.js"
        },
        minify: "esbuild",
    },
});