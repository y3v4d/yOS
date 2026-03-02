import { mount, unmount, type Component } from "svelte";

export function createSvelteContext<T extends Record<string, any>>(component: Component<T>, props: T) {
    return (root: HTMLElement) => {
        const anchor = mount(component, {
            target: root,
            props: props
        });

        return () => {
            unmount(anchor);
        };
    };
}

