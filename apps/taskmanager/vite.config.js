import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { readFileSync } from "fs";

export default defineConfig({
    root: "apps/taskmanager",
    build: {
        outDir: "../../dist/apps",
        emptyOutDir: false,
        lib: {
            name: "main",
            entry: "index.js",
            formats: ["iife"],
            fileName: () => "taskmanager.js"
        },
        rollupOptions: {
            external: (id) => id.startsWith("svelte"),
            output: {
                assetFileNames: "[name][extname]", // preserve names
                globals: {
                    "svelte": "include('svelte').core",
                    "svelte/internal/client": "include('svelte').internalClient",
                    "svelte/reactivity": "include('svelte').reactivity"
                }
            }
        },
        minify: "esbuild",
    },
    plugins: [
        svelte({
            emitCss: false,
            prebundleSvelteLibraries: false
        }),
        /*{
            name: "emit-assets",
            enforce: "pre",
            load(id) {
                if (id.match(/\.(png|jpg|jpeg|gif|svg)$/)) {
                    const fileName = id.split("/").pop();
                    this.emitFile({
                        type: "asset",
                        fileName: "assets/" + fileName,
                        source: readFileSync(id)
                    });
                    // Return the file name as the module's value
                    return `export default "assets/${fileName}"`;
                }
            }
        }*/
    ]
});