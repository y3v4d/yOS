import { defineConfig } from "vite";

export default defineConfig({
    root: "apps/installer",
    build: {
        outDir: "../../dist/apps",
        emptyOutDir: false,
        lib: {
            name: "main",
            entry: "index.js",
            formats: ["iife"],
            fileName: () => "installer.js"
        },
        minify: "esbuild"
    }
});