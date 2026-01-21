<script lang="ts">
    import img_btn_maximize from "$lib/assets/icons/icon_btn_maximize.png";
    import img_btn_minimize from "$lib/assets/icons/icon_btn_minimize.png";
    import img_btn_close from "$lib/assets/icons/icon_btn_close.png";
    import { onMount, type Snippet } from "svelte";
    import { WindowStyle } from "./WindowStyle";
    import Button from "./Button.svelte";

    export interface WindowProps {
        x: number;
        y: number;
        width: number;
        height: number;
        title: string;
        color?: string;
        style?: WindowStyle;
        icon?: string;
        mouseDown?: (x: number, y: number) => void;
        mouseMove?: (x: number, y: number) => void;
        mouseUp?: (x: number, y: number) => void;
        mouseLeave?: (x: number, y: number) => void;
        keyDown?: (key: string) => void;
        focusRequested?: (self: HTMLDivElement) => void;
        closeRequested?: () => void;
        maximizeRequested?: (self: HTMLDivElement, isMaximized: boolean) => void;
        children?: Snippet;
    }

    let { 
        x = $bindable(0), 
        y = $bindable(0),
        width = $bindable(0), 
        height = $bindable(0), 
        title,
        color = "#D9D9D9",
        style = WindowStyle.DEFAULT,
        icon,
        mouseDown,
        mouseMove,
        mouseUp,
        mouseLeave,
        keyDown,
        focusRequested,
        closeRequested,
        maximizeRequested,
        children
    }: WindowProps = $props();

    let windowElement: HTMLDivElement;
    let contentElement: HTMLDivElement;

    let lockMaximize: boolean = $state(false);
    let isMaximized: boolean = $state(false);

    // drag and drop
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onPointerDown = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        isDragging = true;

        offsetX = event.clientX - windowElement.offsetLeft;
        offsetY = event.clientY - windowElement.offsetTop;

        target.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
        if(!windowElement) return;

        if (!lockMaximize && isDragging) {
            x = event.clientX - offsetX;
            y = event.clientY - offsetY;

            windowElement.style.left = `${Math.floor(x)}px`;
            windowElement.style.top = `${Math.floor(y)}px`;
        }
    };

    const onPointerCancel = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        isDragging = false;
    };

    const onPointerLeave = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        isDragging = false;
    };

    const onPointerUp = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        isDragging = false;
    };

    onMount(() => {
        const onWindowResize = () => {
            const clientWidth = window.innerWidth;

            if(clientWidth < 600) {
                lockMaximize = true;
                maximize();
            } else {
                lockMaximize = false;
                minimize();
            }
        };

        const onContentPointerDown = (event: PointerEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseDown?.(x, y);
        };

        const onContentPointerMove = (event: PointerEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseMove?.(x, y);
        };

        const onContentPointerUp = (event: PointerEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseUp?.(x, y);
        };

        const onContentPointerLeave = (event: PointerEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseLeave?.(x, y);
        };

        const onWindowKeyDown = (event: KeyboardEvent) => {
            keyDown?.(event.key);
        };

        const onWindowFocusIn = () => {
            onFocusRequested();
        };

        window.addEventListener("resize", onWindowResize);

        windowElement.addEventListener("keydown", onWindowKeyDown);
        windowElement.addEventListener("focusin", onWindowFocusIn);
        
        contentElement.addEventListener("pointerdown", onContentPointerDown);
        contentElement.addEventListener("pointermove", onContentPointerMove);
        contentElement.addEventListener("pointerup", onContentPointerUp);
        contentElement.addEventListener("pointerleave", onContentPointerLeave);

        onFocusRequested();
        onWindowResize();

        return () => {
            window.removeEventListener("resize", onWindowResize);
        };
    });

    export function maximize() {
        if(isMaximized) return;

        x = 0;
        y = 0;
        width = window.innerWidth - 6;
        height = window.innerHeight - 27 - 28;
        isMaximized = true;

        maximizeRequested?.(windowElement, isMaximized);
    }

    export function minimize() {
        if(!isMaximized) return;

        x = 100;
        y = 100;
        width = 400;
        height = 300;
        isMaximized = false;

        maximizeRequested?.(windowElement, isMaximized);
    }

    function absoluteToWindow(x: number, y: number) {
        const winX = x - windowElement.offsetLeft;
        const winY = y - windowElement.offsetTop - contentElement.offsetTop;
        
        return [winX, winY];
    }

    function hasStyle(flag: WindowStyle): boolean {
        return (style & flag) === flag;
    }

    const onFocusRequested = () => {
        focusRequested?.(windowElement);
    };

    const onCloseRequested = () => {
        closeRequested?.();
    };

    const onMinimizeRequested = () => {
        //minimize();
    };

    const onMaximizeRequested = () => {
        if(isMaximized) {
            minimize();
        } else {
            maximize();
        }
    };

    /*
        style:outline={!hasStyle(WindowStyle.NO_BORDER) ? "2px solid #C0C0C0" : ""}
        style:box-shadow={!hasStyle(WindowStyle.NO_SHADOW) ? "4px 4px 0 #333333" : ""} 
     */
</script>

<div bind:this={windowElement} 
    class="absolute flex flex-col panel-raised"
    role="dialog"
    tabindex="-1"
    style:left="{x}px"
    style:top="{y}px"
    style:background-color="#C0C0C0"
>
    {#if !hasStyle(WindowStyle.NO_TITLE_BAR)}
        <div 
            class="title-bar" 

            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointerleave={onPointerLeave}
            onpointercancel={onPointerCancel}
        >
            {#if icon}
                <img src={icon} alt="icon" class="w-4 h-4 pointer-events-none" style="image-rendering: pixelated; margin-right: 3px;" />
            {/if}
            <span class="grow font-bold pointer-events-none leading-3 mr-2">{title}</span>
            {#if true}
                <Button>
                    <img src={img_btn_minimize} alt="Minimize" style="pointer-events: none; image-rendering: pixelated; margin: 7px 4px 1px 2px;" />
                </Button>
                <Button onclick={onMaximizeRequested}>
                    <img src={img_btn_maximize} alt="Maximize" style="pointer-events: none; image-rendering: pixelated; margin: 0px 2px 1px 1px;" />
                </Button>
                <div style:width="2px"></div>
            {/if}
            <Button onclick={onCloseRequested}>
                <img src={img_btn_close} alt="Close" class="pointer-events-none" style="image-rendering: pixelated; margin: 1px 2px 2px;" />
            </Button>
        </div>
    {/if}
    <div bind:this={contentElement} class="relative overflow-hidden" style="margin: 1px;" style:width="{width}px" style:height="{height}px">
        {@render children?.()}
    </div>
</div>

<style lang="postcss">
    @reference '$src/app.css';

    .title-bar {
        @apply text-white cursor-move select-none flex items-center justify-center;
        background: linear-gradient(to right, #000080, #1084D0);
        padding: 2px 2px 2px 3px;
        margin: 1px 1px 0px 1px;
    }

    .title-bar--inactive {
        background: linear-gradient(to right, #808080, #B5B5B5);
    }
</style>