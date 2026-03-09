<script lang="ts">
    import scrollbar_backing from "./assets/scrollbar_backing.png";
    import icon_arrow_up from "./assets/icon_arrow_up.png";
    import icon_arrow_down from "./assets/icon_arrow_down.png";
    import icon_arrow_left from "./assets/icon_arrow_left.png";
    import icon_arrow_right from "./assets/icon_arrow_right.png";
    import icon_arrow_up_disabled from "./assets/icon_arrow_up_disabled.png";
    import icon_arrow_down_disabled from "./assets/icon_arrow_down_disabled.png";
    import icon_arrow_left_disabled from "./assets/icon_arrow_left_disabled.png";
    import icon_arrow_right_disabled from "./assets/icon_arrow_right_disabled.png";
    import Button from "./button.svelte";

    interface ScrollbarHandleParams {
        scrollSize: number;
        clientSize: number;
        scrollPosition: number;
        axis: "vertical" | "horizontal";
    }

    let {
        scrollSize,
        clientSize,
        scrollPosition = $bindable(0),
        axis
    }: ScrollbarHandleParams = $props();

    let scrollbarElement: HTMLDivElement = $state<HTMLDivElement>(null!);

    let scrollbarSize = $state<number>(0);
    let handlePosition = $state<number>(0);
    let handleSize = $derived(() => Math.max((clientSize / scrollSize) * scrollbarSize, 8));
    let scrollbarActive = $derived(() => scrollSize > clientSize);

    let isDragging = false;
    let dragStart = 0;
    let initialScrollPosition = 0;

    $effect(() => {
        if(!scrollbarElement) return;
        clientSize;

        if(axis === "vertical") {
            scrollbarSize = scrollbarElement.clientHeight;
        } else {
            scrollbarSize = scrollbarElement.clientWidth;
        }
    });

    $effect(() => {
        handlePosition = (scrollPosition / scrollSize) * scrollbarSize;
    });

    const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        target.setPointerCapture(event.pointerId);

        isDragging = true;
        dragStart = axis === "vertical" ? event.clientY : event.clientX;
        initialScrollPosition = scrollPosition;
    };

    const handlePointerMove = (event: PointerEvent) => {
        if(!isDragging) return;

        const pos = axis === "vertical" ? event.clientY : event.clientX;
        const delta = pos - dragStart;
        const newScrollPosition = initialScrollPosition + delta * (scrollSize / scrollbarSize);

        scrollPosition = Math.max(0, Math.min(newScrollPosition, scrollSize - clientSize));
    };

    const handlePointerUp = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        isDragging = false;
    };

    const handleUpLeftButtonClick = () => {
        scrollPosition = Math.max(0, scrollPosition - 8);
    };

    const handleDownRightButtonClick = () => {
        scrollPosition = Math.min(scrollSize - clientSize, scrollPosition + 8);
    };

</script>

<div 
    class:scrollbar-vertical={axis === "vertical"} 
    class:scrollbar-horizontal={axis === "horizontal"} 
>
    <Button style="width: 16px; height: 16px;" disabled={!scrollbarActive()} onclick={handleUpLeftButtonClick} onheld={handleUpLeftButtonClick}>
        <img src={scrollbarActive()
            ? (axis === "vertical" ? icon_arrow_up : icon_arrow_left)
            : (axis === "vertical" ? icon_arrow_up_disabled : icon_arrow_left_disabled)
        } 
            alt="Scroll Up" 
            width={8} 
            height={8} 
            style="image-rendering: pixelated;"
        />
    </Button>

    <div 
        bind:this={scrollbarElement}
        style="flex: 1; position: relative; background-image: url('{scrollbar_backing}'); background-size: repeat; image-rendering: pixelated;"
    >
        {#if scrollbarActive()}
            <button 
                class="scrollbar-handle"

                class:panel-raised={scrollbarActive()}
                class:panel-lowered={!scrollbarActive()}
                class:scrollbar-handle-vertical={axis === "vertical"} 
                class:scrollbar-handle-horizontal={axis === "horizontal"} 
                
                aria-label="Scroll Handle"
                disabled={!scrollbarActive()}

                style:top={axis === "vertical" ? `${handlePosition}px` : "0px"}
                style:left={axis === "horizontal" ? `${handlePosition}px` : "0px"}
                
                style:height={axis === "vertical" ? `${handleSize()}px` : "16px"}
                style:width={axis === "horizontal" ? `${handleSize()}px` : "16px"}

                onpointerdown={handlePointerDown}
                onpointermove={handlePointerMove}
                onpointerup={handlePointerUp}
                onpointercancel={handlePointerUp}
            >

            </button>
        {/if}
    </div>
    <Button style="width: 16px; height: 16px;" disabled={!scrollbarActive()} onclick={handleDownRightButtonClick} onheld={handleDownRightButtonClick}>
        <img src={scrollbarActive()
            ? (axis === "vertical" ? icon_arrow_down : icon_arrow_right)
            : (axis === "vertical" ? icon_arrow_down_disabled : icon_arrow_right_disabled)
        }
            alt="Scroll Down" 
            width={8} 
            height={8} 
            style="image-rendering: pixelated;"
        />
    </Button>
</div>

<style>
    .scrollbar-vertical {
        width: 16px;
        height: 100%;

        display: flex;
        flex-direction: column;
    }

    .scrollbar-horizontal {
        height: 16px;
        width: 100%;

        display: flex;
        flex-direction: row;
    }

    .scrollbar-handle-vertical {
        position: absolute;
        width: 16px;
    }

    .scrollbar-handle-horizontal {
        position: absolute;
        height: 16px;
    }

    .scrollbar-handle {
        cursor: pointer;
    }

    .scrollbar-handle:disabled {
        cursor: default;
    }
</style>