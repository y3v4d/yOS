import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
    root: "libs/svelte",
    build: {
        outDir: "../../dist/libs",
        emptyOutDir: false,
        lib: {
            name: "main",
            entry: "index.ts",
            formats: ["iife"],
            fileName: () => "svelte.js"
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
            include(id) {
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