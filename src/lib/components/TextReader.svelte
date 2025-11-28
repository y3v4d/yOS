<script lang="ts">
    import Window, { type WindowProps } from "./core/Window.svelte";
    import icon_extension_txt from "$lib/assets/icons/icon_extension_txt.png";
    import { onMount, tick } from "svelte";

    interface Props extends Partial<WindowProps> {
        filename: string;
    }

    let {
        filename,
        ...windowProps
    }: Props = $props();

    windowProps = {
        x: 100,
        y: 100,
        width: 400,
        height: 300,
        ...windowProps
    };

    let extension = filename.split('.').pop() || "";
    let content: string = $state("");
    let contentElement: HTMLDivElement = $state(null!);
    let contentHeight: number = $state(0);
    let contentScrollHeight: number = $state(0);
    let isContentOverflowing: boolean = $derived(contentScrollHeight > contentHeight);
    let scrollHandleY = $state(0);
    let scrollHandleHeight = $state(64);
    let windowHeight = $derived(windowProps.height || 300);

    $effect.pre(() => {
        content.length;
        windowHeight;

        if(contentElement) {
            tick().then(() => {
                contentElement.scrollTo(0, 0);
                updateScrollHandle();
            });
        }
    });

    // dynamically load the file content from filename (files are in static/hdd)
    onMount(() => {
        if(!isExtensionSupported(extension)) {
            content = "ERROR: Unsupported file format.";
            return;
        }

        contentElement.addEventListener("scroll", () => {
            console.log(`Scroll position: ${contentElement.scrollTop}`);
            updateScrollHandle();
        });

        fetch(`/hdd/${filename}`)
        .then(async (response) => {
            if(!response.ok) {
                content = `ERROR: Could not load file "${filename}".`;
                return;
            }
            
            content = await response.text();
        })
        .catch(() => {
            content = `ERROR: Could not load file "${filename}".`;
        });
    });

    function updateScrollHandle() {
        contentHeight = contentElement.clientHeight;
        contentScrollHeight = contentElement.scrollHeight;

        if(!isContentOverflowing) {
            scrollHandleY = 0;
            scrollHandleHeight = 0;
            return;
        }

        const visibleRatio = contentHeight / contentScrollHeight;
        scrollHandleHeight = Math.floor(Math.max(visibleRatio * contentHeight, 16)); // minimum size

        const scrollRatio = Math.min(Math.max(contentElement.scrollTop / (contentScrollHeight - contentHeight), 0), 1);
        console.log(`Scroll ratio: ${scrollRatio}`);
        scrollHandleY = Math.floor(scrollRatio * (contentHeight - scrollHandleHeight));
    }

    function isExtensionSupported(ext: string): boolean {
        const supportedExtensions = ["txt"];
        return supportedExtensions.includes(ext.toLowerCase());
    }
</script>

<Window x={100} y={100} width={400} bind:height={windowHeight} title="Text Reader - {filename}" icon={icon_extension_txt} {...windowProps}>
    <div class="w-full h-full flex bg-[#F0F0F0]">
        <div bind:this={contentElement} class="grow no-scrollbar w-full h-full p-2 text-black overflow-auto overscroll-contain whitespace-pre-wrap break-words">
            <p class="font-mono text-xs">
                {#if content === ""}
                    Loading...
                {:else}
                    {content}
                {/if}
            </p>
        </div>
        {#if isContentOverflowing}
            <div class="h-full w-3 bg-gray-300">
                <div class="w-full min-h-2 box" style="height: {scrollHandleHeight}px; transform: translateY({scrollHandleY}px);"></div>
            </div>
        {/if}
    </div>
    
</Window>

<style lang="postcss">
    .no-scrollbar {
        -ms-overflow-style: none;  /* Internet Explorer 10+ */
        scrollbar-width: none;  /* Firefox */
    }

    /* WebKit */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
</style>