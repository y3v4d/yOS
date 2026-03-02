// @ts-expect-error: vue lacks this type definition
import { createApp, type Component } from "vue/dist/vue.esm-bundler.js";

export function createVueContext(component: Component, props: Record<string, any>) {
    return (root: HTMLElement) => {
        const app = createApp(component, props);
        app.mount(root);

        return () => {
            app.unmount();
        }
    }
}