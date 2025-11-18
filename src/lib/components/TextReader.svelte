<script lang="ts">
    import Window from "./core/Window.svelte";
    import img_ext_svg from "$lib/assets/icons/icon_extension_txt.svg";
    import { onMount } from "svelte";

    interface Props {
        filename: string;
        onFocusRequested?: (self: HTMLDivElement) => void;
        onClose?: () => void;
    }

    let {
        filename,
        onFocusRequested,
        onClose
    }: Props = $props();

    let extension = filename.split('.').pop() || "";
    let content: string = $state("");

    // dynamically load the file content from filename (files are in static/hdd)
    onMount(async() => {
        if(!isExtensionSupported(extension)) {
            content = "ERROR: Unsupported file format.";
            return;
        }

        try {
            const response = await fetch(`/hdd/${filename}`);
            if(!response.ok) {
                content = `ERROR: Could not load file "${filename}".`;
                return;
            }
            
            content = await response.text();
        } catch (error) {
            content = `ERROR: Could not load file "${filename}".`;
        }
    });

    function isExtensionSupported(ext: string): boolean {
        const supportedExtensions = ["txt"];
        return supportedExtensions.includes(ext.toLowerCase());
    }
</script>

<Window x={100} y={100} width={400} height={300} title="Text Reader - {filename}" icon={img_ext_svg} focusRequested={onFocusRequested} closeRequested={onClose}>
    <div class="w-full h-full p-2 bg-white text-black overflow-auto whitespace-pre-wrap break-words">
        {#if content === ""}
            <p>Loading...</p>
        {:else}
            {content}
        {/if}
    </div>
</Window>