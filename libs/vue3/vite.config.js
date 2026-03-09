import { defineConfig } from "vite";

export default defineConfig({
    root: "libs/vue3",
    build: {
        outDir: "../../dist/libs",
        emptyOutDir: false,
        lib: {
            name: "main",
            entry: "index.ts",
            formats: ["iife"],
            fileName: () => "vue3.js"
        },
        minify: "esbuild",
    },
});