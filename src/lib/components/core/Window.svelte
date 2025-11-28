<script lang="ts">
    import img_btn_maximize from "$lib/assets/icons/img_btn_maximize.png";
    import img_btn_close from "$lib/assets/icons/img_btn_close.png";
    import { onMount, type Snippet } from "svelte";
    import { WindowStyle } from "./WindowStyle";

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
    let titleBarElement: HTMLDivElement | null = $state(null);
    let contentElement: HTMLDivElement;

    let lockMaximize: boolean = $state(false);
    let isMaximized: boolean = $state(false);

    onMount(() => {
        // drag and drop
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onMouseDown = (event: MouseEvent) => {
            isDragging = true;

            offsetX = event.clientX - windowElement.offsetLeft;
            offsetY = event.clientY - windowElement.offsetTop;
        };

        const onTouchStart = (event: TouchEvent) => {
            isDragging = true;

            offsetX = event.touches[0].clientX - windowElement.offsetLeft;
            offsetY = event.touches[0].clientY - windowElement.offsetTop;
        };

        const onTouchMove = (event: TouchEvent) => {
            if (!lockMaximize && isDragging) {
                x = event.touches[0].clientX - offsetX;
                y = event.touches[0].clientY - offsetY;

                windowElement.style.left = `${x}px`;
                windowElement.style.top = `${y}px`;
            }
        };

        const onTouchEnd = () => {
            isDragging = false;
        };

        const onTouchCancel = () => {
            isDragging = false;
        };

        const onMouseMove = (event: MouseEvent) => {
            if(!windowElement) return;

            if (!lockMaximize && isDragging) {
                x = event.clientX - offsetX;
                y = event.clientY - offsetY;

                windowElement.style.left = `${x}px`;
                windowElement.style.top = `${y}px`;
            }
        };

        const onMouseLeave = () => {
            isDragging = false;
        };

        const onMouseUp = () => {
            isDragging = false;
        };

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

        const onContentMouseDown = (event: MouseEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseDown?.(x, y);
        };

        const onContentMouseMove = (event: MouseEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseMove?.(x, y);
        };

        const onContentMouseUp = (event: MouseEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseUp?.(x, y);
        };

        const onContentMouseLeave = (event: MouseEvent) => {
            const [x, y] = absoluteToWindow(event.clientX, event.clientY);
            mouseLeave?.(x, y);
        };

        const onContentTouchDown = (event: TouchEvent) => {
            const [x, y] = absoluteToWindow(event.touches[0].clientX, event.touches[0].clientY);
            mouseDown?.(x, y);
        };

        const onContentTouchMove = (event: TouchEvent) => {
            const [x, y] = absoluteToWindow(event.touches[0].clientX, event.touches[0].clientY);
            mouseMove?.(x, y);
        };

        const onContentTouchUp = (event: TouchEvent) => {
            const [x, y] = absoluteToWindow(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
            mouseUp?.(x, y);
        };

        const onContentTouchLeave = (event: TouchEvent) => {
            const [x, y] = absoluteToWindow(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
            mouseLeave?.(x, y);
        };

        const onWindowKeyDown = (event: KeyboardEvent) => {
            keyDown?.(event.key);
        };

        const onWindowFocusIn = () => {
            onFocusRequested();
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("mouseleave", onMouseLeave);
        window.addEventListener("touchmove", onTouchMove);
        window.addEventListener("touchend", onTouchEnd);
        window.addEventListener("touchcancel", onTouchCancel);
        window.addEventListener("resize", onWindowResize);
        
        titleBarElement?.addEventListener("mousedown", onMouseDown);
        titleBarElement?.addEventListener("mouseup", onMouseUp);
        titleBarElement?.addEventListener("touchstart", onTouchStart);
        titleBarElement?.addEventListener("touchend", onTouchEnd);
        titleBarElement?.addEventListener("touchcancel", onTouchCancel);

        windowElement.addEventListener("keydown", onWindowKeyDown);
        windowElement.addEventListener("focusin", onWindowFocusIn);
        
        contentElement.addEventListener("mousedown", onContentMouseDown);
        contentElement.addEventListener("mousemove", onContentMouseMove);
        contentElement.addEventListener("mouseup", onContentMouseUp);
        contentElement.addEventListener("mouseleave", onContentMouseLeave);

        contentElement.addEventListener("touchstart", onContentTouchDown);
        contentElement.addEventListener("touchmove", onContentTouchMove);
        contentElement.addEventListener("touchend", onContentTouchUp);
        contentElement.addEventListener("touchcancel", onContentTouchLeave);

        onFocusRequested();
        onWindowResize();

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("mouseleave", onMouseLeave);

            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
            window.removeEventListener("touchcancel", onTouchCancel);

            window.removeEventListener("resize", onWindowResize);
        };
    });

    export function maximize() {
        if(isMaximized) return;

        x = 8;
        y = 8;
        width = window.innerWidth - 16;
        height = window.innerHeight - 64 - 16;
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

    const onMaximizeRequested = () => {
        if(isMaximized) {
            minimize();
        } else {
            maximize();
        }
    };
</script>

<div bind:this={windowElement} 
    class="absolute flex flex-col box-border font-mono text-xs"
    tabindex="0"
    style:left="{x}px"
    style:width="{width}px"
    style:top="{y}px"
    style:background-color="{color}"
    style:outline={!hasStyle(WindowStyle.NO_BORDER) ? "2px solid #000" : ""}
    style:box-shadow={!hasStyle(WindowStyle.NO_SHADOW) ? "4px 4px 0 #333333" : ""}
    >
    {#if !hasStyle(WindowStyle.NO_TITLE_BAR)}
        <div bind:this={titleBarElement} class="bg-blue-600 text-white px-1 py-1 h-7 cursor-move select-none flex items-center justify-center">
            {#if icon}
                <img src={icon} alt="icon" class="w-4 h-4 mr-1 pointer-events-none" style="image-rendering: pixelated;" />
            {/if}
            <span class="grow pointer-events-none mr-2">{title}</span>
            {#if !lockMaximize}
                <button class="cursor-pointer" onclick={onMaximizeRequested}>
                    <img src={img_btn_maximize} alt="Maximize" class="w-4 h-4" style="image-rendering: pixelated;" />
                </button>
                <div class="w-1"></div>
            {/if}
            <button class="cursor-pointer" onclick={onCloseRequested}>
                <img src={img_btn_close} alt="Close" class="w-4 h-4" style="image-rendering: pixelated;" />
            </button>
        </div>
    {/if}
    <div bind:this={contentElement} class="relative overflow-hidden" style:width="{width}px" style:height="{height}px">
        {@render children?.()}
    </div>
</div>