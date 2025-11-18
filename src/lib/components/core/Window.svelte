<script lang="ts">
    import closeBtnSvg from "$lib/assets/icons/img_btn_close.svg";
    import { onMount, type Snippet } from "svelte";
    import { WindowStyle } from "./WindowStyle";

    interface Props {
        x: number;
        y: number;
        width: number;
        height: number;
        title: string;
        color?: string;
        style?: WindowStyle;
        icon?: string;
        focusRequested?: (self: HTMLDivElement) => void;
        closeRequested?: () => void;
        children?: Snippet;
    }

    let { 
        x, 
        y,
        width, 
        height, 
        title,
        color = "#D9D9D9",
        style = WindowStyle.DEFAULT,
        icon,
        focusRequested,
        closeRequested,
        children
    }: Props = $props();

    let windowElement: HTMLDivElement;
    let titleBarElement: HTMLDivElement | null = $state(null);

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
        
        titleBarElement?.addEventListener("mousedown", onMouseDown);
        titleBarElement?.addEventListener("mouseup", onMouseUp);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        onFocusRequested();

        return () => {
            titleBarElement?.removeEventListener("mousedown", onMouseDown);
            titleBarElement?.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    });

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
    class="absolute flex flex-col"
    style:left="{x}px"
    style:width="{width}px"
    style:top="{y}px"
    style:height="{height}px"
    style:background-color="{color}"
    style:border={!hasStyle(WindowStyle.NO_BORDER) ? "2px solid #000" : ""}
    style:box-shadow={!hasStyle(WindowStyle.NO_SHADOW) ? "4px 4px 0 #000" : ""}>
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
    <div class="relative grow overflow-hidden">
        {@render children?.()}
    </div>

</div>