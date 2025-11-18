<script lang="ts">
    import closeBtnSvg from "$lib/assets/icons/img_btn_close.svg";
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
        keyDown?: (key: string) => void;
        focusRequested?: (self: HTMLDivElement) => void;
        closeRequested?: () => void;
        children?: Snippet;
    }

    let { 
        x = $bindable(0), 
        y = $bindable(0),
        width, 
        height, 
        title,
        color = "#D9D9D9",
        style = WindowStyle.DEFAULT,
        icon,
        mouseDown,
        mouseMove,
        mouseUp,
        keyDown,
        focusRequested,
        closeRequested,
        children
    }: WindowProps = $props();

    let windowElement: HTMLDivElement;
    let titleBarElement: HTMLDivElement | null = $state(null);
    let contentElement: HTMLDivElement;

    onMount(() => {
        // drag and drop
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onMouseDown = (event: MouseEvent) => {
            isDragging = true;

            offsetX = event.clientX - windowElement.offsetLeft;
            offsetY = event.clientY - windowElement.offsetTop;

            onFocusRequested();
        };

        const onMouseMove = (event: MouseEvent) => {
            if (isDragging) {
                x = event.clientX - offsetX;
                y = event.clientY - offsetY;

                windowElement.style.left = `${x}px`;
                windowElement.style.top = `${y}px`;
            }
        };

        const onMouseUp = () => {
            isDragging = false;
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

        const onWindowKeyDown = (event: KeyboardEvent) => {
            keyDown?.(event.key);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        
        titleBarElement?.addEventListener("mousedown", onMouseDown);
        titleBarElement?.addEventListener("mouseup", onMouseUp);

        windowElement.addEventListener("keydown", onWindowKeyDown);
        
        contentElement.addEventListener("mousedown", onContentMouseDown);
        contentElement.addEventListener("mousemove", onContentMouseMove);
        contentElement.addEventListener("mouseup", onContentMouseUp);

        onFocusRequested();

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    });

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
</script>

<div bind:this={windowElement} 
    class="absolute flex flex-col box-border"
    tabindex="0"
    style:left="{x}px"
    style:width="{width}px"
    style:top="{y}px"
    style:background-color="{color}"
    style:outline={!hasStyle(WindowStyle.NO_BORDER) ? "2px solid #000" : ""}
    style:box-shadow={!hasStyle(WindowStyle.NO_SHADOW) ? "4px 4px 0 #333333" : ""}>
    {#if !hasStyle(WindowStyle.NO_TITLE_BAR)}
        <div bind:this={titleBarElement} class="bg-blue-600 text-white px-1 py-1 cursor-move select-none flex items-center">
            {#if icon}
                <img src={icon} alt="icon" class="w-4 h-4 mr-1" />
            {/if}
            <span class="grow">{title}</span>
            <button class="mr-1 cursor-pointer" onclick={onCloseRequested}>
                <img src={closeBtnSvg} alt="Close" class="w-3 h-3" />
            </button>
        </div>
    {/if}
    <div bind:this={contentElement} class="relative grow overflow-hidden" style:width="{width}px" style:height="{height}px">
        {@render children?.()}
    </div>
</div>