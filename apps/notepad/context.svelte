<script lang="ts" module>
    export interface NotepadIPC {
        open_file?: (filename: string) => void;
        on_src_content_change?: (content: string) => void;
        on_window_size_change?: (width: number, height: number) => void;

        on_context_mount: () => void;
        on_ctx_content_change: (content: string) => void;
        on_window_resize: (width: number, height: number) => void;
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";

    import ScrollbarHandle from "./scrollbar-handle.svelte";
    import icon_shine_16 from "./assets/icon_shine_16.png";

    interface NotepadParams {
        ipc: NotepadIPC;
    }

    let {
        ipc
    }: NotepadParams = $props();

    let textareaElement: HTMLTextAreaElement = $state<HTMLTextAreaElement>(null!);

    let windowWidth = $state<number>(400);
    let windowHeight = $state<number>(300);

    let content = $state<string>("");
    let scrollHeight = $state<number>(0);
    let scrollWidth = $state<number>(0);
    let scrollTop = $state<number>(0);
    let scrollLeft = $state<number>(0);
    let clientHeight = $state<number>(0);
    let clientWidth = $state<number>(0);

    let showScrollbarVertical = $derived(() => {
        if(!textareaElement) return false;
        return scrollHeight > clientHeight;
    });

    let showScrollbarHorizontal = $derived(() => {
        if(!textareaElement) return false;
        return scrollWidth > clientWidth;
    });

    $effect(() => {
        content;
        showScrollbarVertical();
        showScrollbarHorizontal();

        if(textareaElement) {
            scrollHeight = textareaElement.scrollHeight;
            scrollWidth = textareaElement.scrollWidth;
        }
    });

    $effect(() => {
        if(textareaElement) {
            textareaElement.scrollTop = scrollTop;
            textareaElement.scrollLeft = scrollLeft;
        }
    });

    onMount(() => {
        ipc.on_src_content_change = (newContent) => {
            content = newContent;
        };

        ipc.on_window_size_change = (width, height) => {
            windowWidth = width;
            windowHeight = height;
        };

        ipc.on_context_mount();
    });

    const handleContentChange = (event: Event) => {
        const target = event.target as HTMLTextAreaElement;
        content = target.value;
        
        ipc.on_ctx_content_change(content);
    };

    const handleScroll = (event: Event) => {
        const target = event.target as HTMLTextAreaElement;

        scrollTop = target.scrollTop;
        scrollLeft = target.scrollLeft;
    };

    let isResizing = false;
    let resizeStart = { x: 0, y: 0 };
    let initialSize = { width: 0, height: 0 };

    const handleResizeHandlePointerDown = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        target.setPointerCapture(event.pointerId);

        isResizing = true;
        resizeStart = { x: event.clientX, y: event.clientY };
        initialSize = { width: windowWidth, height: windowHeight };
    };

    const handleResizeHandlePointerMove = (event: PointerEvent) => {
        if(!isResizing) return;

        const deltaX = event.clientX - resizeStart.x;
        const deltaY = event.clientY - resizeStart.y;

        const newWidth = initialSize.width + deltaX;
        const newHeight = initialSize.height + deltaY;

        ipc.on_window_resize(newWidth, newHeight);
    };

    const handleResizeHandlePointerUp = (event: PointerEvent) => {
        const target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        isResizing = false;
    };
</script>

<main class="container">
    <section class="menu-bar">
        <button class="menu-bar-button">
            File
        </button>
        <button class="menu-bar-button">
            Edit
        </button>
        <button class="menu-bar-button">
            Format
        </button>
        <button class="menu-bar-button">
            Help
        </button>
    </section>
    <div class="separator-horizontal"></div>
    <main class="content">
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%;">
            <div style="padding: 2px; background-color: #ffffff; height: 100%; flex: 1;">
                <textarea
                    bind:this={textareaElement}
                    bind:value={content}
                    bind:clientHeight={clientHeight}
                    bind:clientWidth={clientWidth}

                    class="text-editor no-scrollbar"
                    spellcheck="false"
                    wrap="off"

                    oninput={handleContentChange}
                    onscroll={handleScroll}
                ></textarea>
            </div>
            <ScrollbarHandle
                scrollSize={scrollWidth}
                clientSize={clientWidth}
                bind:scrollPosition={scrollLeft}
                axis="horizontal"
            />
        </div>

        <div style="display: flex; flex-direction: column;">
            <ScrollbarHandle
                scrollSize={scrollHeight}
                clientSize={clientHeight}
                bind:scrollPosition={scrollTop}
                axis="vertical"
            />
            <div 
                style="width: 16px; min-height: 16px; height: 16px; background-color: #d4d0c8; cursor: se-resize;"
                onpointerdown={handleResizeHandlePointerDown}
                onpointermove={handleResizeHandlePointerMove}
                onpointerup={handleResizeHandlePointerUp}
                onpointercancel={handleResizeHandlePointerUp}
            >
                <img src={icon_shine_16} alt="Shine" width={16} height={16} style="image-rendering: pixelated; pointer-events: none; user-select: none;" />
            </div>
        </div>
        
    </main>
</main>


<style>
    .container {
        display: flex;
        flex-direction: column;

        width: 100%;
        height: 100%;
    }

    .menu-bar {
        background-color: #C0C0C0;

        width: 100%;
        min-height: 16px;
        height: 16px;
        padding: 2px 0px;
    }

    .menu-bar-button {
        height: 100%;

        background-color: #C0C0C0;

        margin: 0px;
        padding: 2px 6px 2px 6px;

        font-size: 11px;
        cursor: pointer;
    }

    .content {
        width: 100%;
        height: 100%;

        display: flex;
        flex-direction: row;

        background-color: #C0C0C0;
        box-shadow:
            -1px -1px #ffffff inset,
            1px 1px #808080 inset,
            -2px -2px #d4d0c8 inset,
            2px 2px #404040 inset;

        box-sizing: border-box;

        padding: 2px;
    }

    .text-editor {
        width: 100%;
        height: 100%;
        background-color: #ffffff;
        color: #000000;

        font-family: 'MS Sans Serif', sans-serif;
        font-size: 11px;
        line-height: 12p;

        margin: 0px;
        padding: 0px;

        overscroll-behavior: none;

        box-shadow: none;
        border: none;

        box-sizing: border-box;

        resize: none;
        outline: none;
    }
</style>