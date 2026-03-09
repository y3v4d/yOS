<script lang="ts">
    import { onDestroy, type Snippet } from "svelte";
    import type { HTMLButtonAttributes } from "svelte/elements";

    interface ButtonProps extends HTMLButtonAttributes {
        disabled?: boolean;
        onclick?: () => void;
        onheld?: () => void;
        children?: Snippet;
    }

    let {
        disabled = false,
        onclick,
        onheld,
        children,
        ...rest
    }: ButtonProps = $props();

    let hover = $state(false);
    let pressed = $state(false);
    let clazz = $derived(() => rest.class);
    let otherProps = $derived(() => {
        const { class: _, ...other } = rest;
        return other;
    });

    let holdInterval: NodeJS.Timeout | null = null;

    onDestroy(() => {
        if(holdInterval) {
            clearInterval(holdInterval);
        }
    });

    const onPointerDown = (event: PointerEvent) => {
        event.stopPropagation();

        const target = event.currentTarget as HTMLElement;

        pressed = true;
        hover = true;

        target.setPointerCapture(event.pointerId);

        if(onheld) {
            holdInterval = setInterval(() => {
                if(pressed) {
                    onheld();
                }
            }, 100);
        }
    };

    const onPointerMove = (event: PointerEvent) => {
        hover = isPointerInside(event);
    };

    const onPointerUp = (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        pressed = false;

        if(holdInterval) {
            clearInterval(holdInterval);
        }

        if(hover) {
            onclick?.();
        }
    };

    function isPointerInside(event: PointerEvent): boolean {
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();

        return event.clientX >= rect.left &&
               event.clientX <= rect.right &&
               event.clientY >= rect.top &&
               event.clientY <= rect.bottom;
    }
</script>

<button 
    class="panel-raised btn {clazz()}"
    class:panel-lowered={(hover && pressed)}

    disabled={disabled}

    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}

    {...otherProps()}
>
    {@render children?.()}
</button>

<style>
    .btn {
        padding: 2px;
        cursor: pointer;
    }
</style>