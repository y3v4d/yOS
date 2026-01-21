<script lang="ts">
    import type { Snippet } from "svelte";
    import type { HTMLButtonAttributes } from "svelte/elements";

    interface ButtonProps extends HTMLButtonAttributes {
        onclick?: () => void;
        children?: Snippet;
    }

    let {
        onclick,
        children,
        ...rest
    }: ButtonProps = $props();

    let hover = $state(false);
    let pressed = $state(false);

    const onPointerDown = (event: PointerEvent) => {
        event.stopPropagation();

        const target = event.currentTarget as HTMLElement;

        pressed = true;
        hover = true;

        target.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
        hover = isPointerInside(event);
    };

    const onPointerUp = (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        pressed = false;
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
    class="panel-raised"
    class:panel-lowered={hover && pressed}

    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}

    {...rest}
>
    {@render children?.()}
</button>

<style lang="postcss">
    button {
        cursor: pointer;
    }
</style>