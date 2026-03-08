import * as svelte_core from "svelte";
import * as svelte_internal from "svelte/internal/client";
import * as svelte_reactivity from "svelte/reactivity";

export function createContext<T extends Record<string, any>>(component: svelte_core.Component<T>, props: T) {
    return (root: HTMLElement) => {
        const anchor = svelte_core.mount(component, {
            target: root,
            props: props,
        });

        return () => {
            svelte_core.unmount(anchor);
        };
    };
}

export const core = svelte_core;
export const internalClient = svelte_internal;
export const reactivity = svelte_reactivity;