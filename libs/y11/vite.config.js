import { defineConfig } from "vite";

export default defineConfig({
    root: "libs/y11",
    build: {
        outDir: "../../dist/libs",
        emptyOutDir: false,
        lib: {
            name: "main",
            entry: "index.ts",
            formats: ["iife"],
            fileName: () => "y11.js"
        },
        minify: "esbuild",
    },
});