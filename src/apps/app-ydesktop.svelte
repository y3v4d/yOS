<script lang="ts" module>
    export interface DesktopIPC {
        update_tree?: (tree: WindowTreeNode) => void;
        update_processes?: (processes: Process[]) => void;
        update_files?: (files: DesktopEntry[]) => void;
        update_active?: (active: boolean) => void;

        on_context_mount: () => void;
        on_desktop_click: () => void;
        on_open_file_request: (stat: DirEntry) => void;
        play_sound: (soundPath: string) => void;
    }

    export interface WindowTreeNode {
        self: XWindow;
        children: WindowTreeNode[];
        active: boolean;
    }

    export interface DesktopEntry {
        name: string;
        ext: string;

        icon?: string;

        type: "file" | "directory";
        stat: DirEntry;
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import type { Process } from "../yos/core/kernel";
    import type { XWindow } from "../yos/core/x11";
    import type { DirEntry } from "../yos/core/vfs";

    import icon_executable_32 from "../assets/icons/icon_executable_32.png";

    interface DesktopParams {
        ipc: DesktopIPC;
    }

    let {
        ipc
    }: DesktopParams = $props();

    const CLICK_SOUND_PATH = "/sfx/click.mp3";

    let windowTree = $state<WindowTreeNode | null>(null);
    let processes = $state<Process[]>([]);
    let desktopEntries = $state<DesktopEntry[]>([]);
    let lastSelectedEntryIndex = $state<number>(-1);
    let selectedActive = $state<boolean>(false);
    let active = $state<boolean>(false);
    let lastClickTime = $state<number>(0);

    onMount(() => {
        ipc.update_tree = (tree) => {
            windowTree = tree;
        };

        ipc.update_processes = (procs) => {
            processes = procs;
        };

        ipc.update_files = (entries: DesktopEntry[]) => {
            desktopEntries = entries;
        };

        ipc.update_active = (isActive) => {
            active = isActive;
        };

        ipc.on_context_mount();
    });

    const onDesktopClick = () => {
        ipc.on_desktop_click();
        lastSelectedEntryIndex = -1;
    }

    const onDesktopEntryClick = (entry: DesktopEntry) => {
        ipc.on_desktop_click();

        //ipc.on_open_file_request(entry.stat);
        const index = desktopEntries.indexOf(entry);
        if(index === lastSelectedEntryIndex && (Date.now() - lastClickTime) < 500) {
            ipc.on_open_file_request(entry.stat);
            ipc.play_sound(CLICK_SOUND_PATH);
        } else {
            lastSelectedEntryIndex = index;
            selectedActive = true;

            lastClickTime = Date.now();
        }
    };
</script>

<main class="desktop" onpointerdown={onDesktopClick}>
    <div class="debug-info">
        <div>
            {#snippet entry(node: WindowTreeNode, depth: number = 0)}
                <div style="margin-left: {depth * 10}px; font-weight: {node.active ? 'bold' : 'normal'};">
                    - #{node.self.id} ({node.self.props["_NET_WM_NAME"] || "untitled"})
                </div>
                {#each node.children as child}
                    {@render entry(child, depth + 1)}
                {/each}
            {/snippet}

            <div>Window Tree</div>
            {#if windowTree}
                {@render entry(windowTree)}
            {/if}
        </div>
        <div>
            <div>Processes</div>
            {#each processes as process}
                <div>
                    - PID #{process.pid} ({process})
                </div>
            {/each}
        </div>
    </div>

    <!--<img 
        style="position: absolute; bottom: 16px; right: 16px; opacity: 0.75; user-select: none; pointer-events: none; image-rendering: pixelated;" 
        width="128px"
        height="128px"
        src="/logo.png" 
        alt="Logo"
    />-->

    <p style="position: absolute; bottom: 6px; right: 6px; font-size: 13px; line-height: 13px; color: white; opacity: 0.25; user-select: none; font-weight: bold;">
        y3v4d @ 2026
    </p>
    
    {#each desktopEntries as entry, index (entry.stat)}
        <button class="desktop-icon" onpointerdown={(event) => {
            event.stopPropagation();
            onDesktopEntryClick(entry);
        }}>
            <img src={entry.icon ?? icon_executable_32} alt="icon" width={32} height={32} style="image-rendering: pixelated;" />
            <span 
                class="desktop-icon__label"
                class:desktop-icon__label__selected={active && lastSelectedEntryIndex === index}
                class:desktop-icon__label__selected_full={lastSelectedEntryIndex === index}
            >
                {entry.name}
            </span>
        </button>
    {/each}
</main>

<style>
    .desktop {
        position: relative;

        display: flex;
        flex-direction: row;

        width: 100%;
        height: 100%;

        background-color: #00A0A0;
    }

    .desktop-icon {
        display: flex;
        flex-direction: column;
        align-items: center;

        gap: 4px;

        width: 80px;
        height: 64px;

        margin: 4px;
    }

    .desktop-icon__label__selected {
        border-style: dashed;
        border-width: 1px;
        border-color: white;
    }

    .desktop-icon__label__selected_full {
        background-color: #000A71;
        color: white;

        padding: 1px;
        box-sizing: border-box;
    }

    .desktop-icon__label {
        font-size: 11px;
        line-height: 12px;

        color: white;
        text-align: center;

        word-break: break-word;
    }

    .debug-info {
        display: none;
        position: absolute;
        bottom: 32px;
        left: 2px;

        background-color: #202020;
        color: white;

        padding: 4px 8px;
    }
</style>