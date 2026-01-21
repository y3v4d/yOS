<script lang="ts">
    import Window, { type WindowProps } from "./core/Window.svelte";
    import icon_notepad_16 from "$lib/assets/icons/icon_notepad2_16.png";
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

    let extension = $derived(filename.split('.').pop() || "");
    let content: string = $state("");
    let contentElement: HTMLDivElement = $state(null!);
    let contentHeight: number = $state(0);
    let contentScrollHeight: number = $state(0);
    let isContentOverflowing: boolean = $derived(contentScrollHeight > contentHeight);
    let scrollHandleY = $state(0);
    let scrollHandleHeight = $state(64);
    let windowHeight = $derived(windowProps.height || 300);

    // split content to tokens when it changes
    type Token = 
        | { type: "text", value: string }
        | { type: "link", value: string }
        | { type: "newline" };

    const tokens = $derived.by(() => {
        const result: Token[] = [];
        let lines = content.split('\n');

        for(let i = 0; i < lines.length; i++) {
            if(i > 0) {
                result.push({ type: "newline" });
            }

            const findLink = /https?:\/\/[^\s]+/g;
            const line = lines[i];

            let lastIndex = 0;
            let match: RegExpExecArray | null;

            while((match = findLink.exec(line)) !== null) {
                if(match.index > lastIndex) {
                    result.push({ type: "text", value: line.substring(lastIndex, match.index) });
                }

                result.push({ type: "link", value: match[0] });
                lastIndex = match.index + match[0].length;
            }

            if(lastIndex < line.length) {
                result.push({ type: "text", value: line.substring(lastIndex) });
            }
        }

        return result;
    });

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

        fetch(`/hdd/${filename}?t=0.2.0`)
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

    let handleYOffset: number = 0;

    function onHandlePointerDown(event: PointerEvent) {
        const target = event.target as HTMLElement;

        event.preventDefault();
        target.setPointerCapture(event.pointerId);

        handleYOffset = event.clientY - scrollHandleY;
    }

    function onHandlePointerMove(event: PointerEvent) {
        const target = event.target as HTMLElement;
        if(!target.hasPointerCapture(event.pointerId)) {
            return;
        }

        event.preventDefault();

        let newHandleY = event.clientY - handleYOffset;
        newHandleY = Math.min(Math.max(newHandleY, 0), contentHeight - scrollHandleHeight);

        const scrollRatio = newHandleY / (contentHeight - scrollHandleHeight);
        contentElement.scrollTo(0, scrollRatio * (contentScrollHeight - contentHeight));

        updateScrollHandle();
    }

    function onHandlePointerUp(event: PointerEvent) {
        const target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);
    }
</script>

<Window x={100} y={100} width={400} bind:height={windowHeight} title="Text Reader - {filename}" icon={icon_notepad_16} {...windowProps}>
    <main class="content">
        <div class="w-full h-full flex bg-[#F0F0F0]">
            <div bind:this={contentElement} class="grow select-text no-scrollbar w-full h-full p-2 text-black overflow-auto overscroll-none whitespace-pre-wrap break-words">
                <main class="">
                    {#if tokens.length === 0}
                        Loading...
                    {:else}
                        {#each tokens as token}
                            {#if token.type === "text"}
                                <span>{token.value}</span>
                            {:else if token.type === "link"}
                                <a href="{token.value}" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{token.value}</a>
                            {:else if token.type === "newline"}
                                <br/>
                            {/if}
                        {/each}
                    {/if}
                </main>
            </div>
            {#if isContentOverflowing}
                <div class="h-full w-3 bg-gray-300">
                    <div 
                        class="w-full min-h-2 box" 
                        style="height: {scrollHandleHeight}px; transform: translateY({scrollHandleY}px);"
                        onpointerdown={onHandlePointerDown}
                        onpointermove={onHandlePointerMove}
                        onpointerup={onHandlePointerUp}
                    ></div>
                </div>
            {/if}
        </div>
    </main>
</Window>

<style lang="postcss">
    .content {
        width: 100%;
        height: 100%;

        box-shadow: 
            -1px -1px #FFFFFF inset,
            1px 1px #929292 inset;
        padding: 1px;
    }

    .no-scrollbar {
        -ms-overflow-style: none;  /* Internet Explorer 10+ */
        scrollbar-width: none;  /* Firefox */
    }

    /* WebKit */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
</style>