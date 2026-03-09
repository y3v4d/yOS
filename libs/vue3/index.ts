// @ts-ignore
import * as vue3 from "vue/dist/vue.esm-browser.js";

export const core = vue3;

export function createContext<T extends Record<string, any>>(component: vue3.Component<T>, props: T) {
    return (root: HTMLElement) => {
        const app = vue3.createApp(component, props);
        app.mount(root);

        return () => {
            app.unmount();
        };
    };
}