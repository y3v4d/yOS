<script lang="ts" module>
    export interface IPC {
        fetched_directory?: (data: {
            entries: Entry[];
            path: string;
        } | null, error: string | null) => void;

        on_context_mount: () => void;
        on_navigate: (path: string) => void;
    }

    export type EntryType = "file" | "directory" | "shortcut";

    export interface Entry {
        type: EntryType;
        name: string;

        ext?: string;
        icon?: string;
        size?: number;

        created_at: number;
        modified_at: number;
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";

    import icon_shortcut_overlay from "./assets/icon_shortcut_overlay.png";
    import Button from "./button.svelte";

    interface Props {
        ipc: IPC;
    }

    let {
        ipc
    }: Props = $props();

    let history: string[] = $state([]);

    let entries = $state<Entry[]>([]);
    let currentPath = $state<string>("");
    let selectedEntryIndex = $state<number>(-1);

    onMount(() => {
        ipc.fetched_directory = (data, error) => {
            if(error) {
                alert("Error fetching directory: " + error);
                return;
            }

            selectedEntryIndex = -1;
            entries = data.entries.sort((a, b) => {
                if(a.type === b.type) {
                    return a.name.localeCompare(b.name);
                }

                if(a.type === "directory") return -1;
                if(b.type === "directory") return 1;

                return 0;
            });
            currentPath = data.path;

            console.log("Received directory data:", data);
        };
        
        ipc.on_context_mount();
    });
</script>

<div class="container">
    <div class="topbar">
        <p>Address</p>
        <div class="address-bar panel-lowered">
            <p>{currentPath}</p>
        </div>
        <Button style="padding: 4px 6px;" disabled={history.length === 0} onclick={() => {
            if(history.length === 0) return;

            const previousPath = history.pop();
            console.log("Navigating back to:", previousPath);
            ipc.on_navigate(previousPath);
        }}>
            <p>Back</p>
        </Button>
    </div>
    
    <div 
        class="file-list panel-lowered"
        onpointerdown={() => selectedEntryIndex = -1}
    >
        <div class="file-list-inner">
            {#each entries as entry, index}
                <button
                    class="entry"
                    style:width="80px"
                    style:height="64px"

                    onpointerdown={(event) => {
                        event.stopPropagation();
                        selectedEntryIndex = index;
                    }}
                    ondblclick={() => {
                        history.push(currentPath);
                        ipc.on_navigate(currentPath + "/" + entry.name)
                    }}
                >
                    <div style="width: 32px; height: 32px; position: relative;">
                        <img 
                            src={entry.icon} 
                            alt="icon" 
                            width={32} 
                            height={32} 
                            style="image-rendering: pixelated; pointer-events: none;" 
                        >
                        <div style="
                            position: absolute; 
                            inset: 0; 
                            background-color: #000A71; 
                            mask-image: url({entry.icon}); 
                            mask-repeat: no-repeat; 
                            mask-position: center; 
                            mask-size: cover; 
                            opacity: {selectedEntryIndex === index ? 0.5 : 0};
                            pointer-events: none;"
                        ></div>
                        {#if entry.ext === "lnk"}
                            <img 
                                src={icon_shortcut_overlay}
                                alt="shortcut overlay" 
                                width={11} 
                                height={11} 
                                style="position: absolute; bottom: 0; left: 0; image-rendering: pixelated; pointer-events: none;"
                            >
                        {/if}
                    </div>
                    
                    <span 
                        class="entry-label"
                        class:entry-label-selected={selectedEntryIndex === index}
                    >
                        {entry.name}
                    </span>
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    .container {
        width: 100%;
        height: 100%;

        display: flex;
        flex-direction: column;
    }

    .topbar {
        background-color: #C0C0C0;
        display: flex;
        align-items: center;
        gap: 2px;

        padding: 1px 0px 1px 4px;
    }

    .address-bar {
        flex-grow: 1;
        background-color: white;
        padding: 4px 4px;
    }

    .file-list {
        background-color: white;
        flex-grow: 1;
        
        padding: 4px;
        overflow-y: auto;
    }

    .file-list-inner {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .entry {
        display: flex;
        flex-direction: column;
        align-items: center;

        gap: 4px;
        padding-top: 8px;
    }

    .entry-label {
        font-size: 11px;
        line-height: 12px;

        color: black;
        text-align: center;

        border-width: 1px;
        border-style: solid;
        border-color: transparent;

        word-break: break-word;
    }

    .entry-label-selected {
        background-color: #000A71;
        color: white;
    }
</style>