<script lang="ts" module>
    export interface DesktopIPC {
        update_tree?: (tree: WindowTreeNode) => void;
        update_processes?: (processes: Process[]) => void;
        update_files?: (files: DesktopEntry[]) => void;
        update_active?: (active: boolean) => void;
        update_entry_size?: (width: number, height: number) => void;

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
        x: number;
        y: number;

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
    import icon_shortcut_overlay from "../assets/icons/icon_shortcut_overlay.png";

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
    let active = $state<boolean>(false);
    let lastClickTime = $state<number>(0);

    let clientWidth = $state<number>(0);
    let clientHeight = $state<number>(0);
    let entryWidth = $state<number>(80);
    let entryHeight = $state<number>(64);

    let maxColumns = $derived<number>(Math.floor(clientWidth / entryWidth));
    let maxRows = $derived<number>(Math.floor(clientHeight / entryHeight));

    onMount(() => {
        ipc.update_tree = (tree) => {
            windowTree = tree;
        };

        ipc.update_processes = (procs) => {
            processes = procs;
        };

        ipc.update_files = (entries: DesktopEntry[]) => {
            for(const entry of entries) {
                if(entry.x === -1 || entry.y === -1) {
                    const cell = getNextAvailableCell(entries);
                    entry.x = cell.x;
                    entry.y = cell.y;
                }
            }

            desktopEntries = entries;
        };

        ipc.update_active = (isActive) => {
            active = isActive;
        };

        ipc.update_entry_size = (width, height) => {
            entryWidth = width;
            entryHeight = height;
        };

        console.log("Desktop mounted, calling on_context_mount");
        console.log(clientWidth, clientHeight);

        ipc.on_context_mount();
    });

    function getNextAvailableCell(entries: DesktopEntry[]) {
        const occupiedCells = new Set<string>();
        for(const entry of entries) {
            if(entry.x !== -1 && entry.y !== -1) {
                occupiedCells.add(`${entry.x},${entry.y}`);
            }
        }

        for(let col = 0; col < maxColumns; col++) {
            for(let row = 0; row < maxRows; row++) {
                const cellKey = `${col},${row}`;
                if(!occupiedCells.has(cellKey)) {
                    return { x: col, y: row };
                }
            }
        }

        return { x: 0, y: 0 };
    }

    function getDesktopGrid(entries: DesktopEntry[], exclude: DesktopEntry | null = null) {
        const grid: (DesktopEntry | null)[][] = [];
        for(let col = 0; col < maxColumns; col++) {
            grid[col] = [];
            for(let row = 0; row < maxRows; row++) {
                grid[col][row] = null;
            }
        }

        for(const entry of entries) {
            if(entry.x !== -1 && entry.y !== -1 && entry !== exclude) {
                grid[entry.x][entry.y] = entry;
            }
        }

        return grid;
    }

    function checkGridCollision(grid: (DesktopEntry | null)[][], x: number, y: number) {
        if(x < 0 || x >= maxColumns || y < 0 || y >= maxRows) {
            return true;
        }

        return grid[x][y] !== null;
    }

    const onDesktopClick = () => {
        ipc.on_desktop_click();
        lastSelectedEntryIndex = -1;
    };

    let canDrag = false;
    let draggingEntryIndex = $state<number>(-1);

    const onDesktopEntryPointerDown = (event: PointerEvent, entry: DesktopEntry) => {
        const target = event.target as HTMLElement;
        event.stopPropagation();

        ipc.on_desktop_click();

        const index = desktopEntries.indexOf(entry);
        if(index === lastSelectedEntryIndex && (Date.now() - lastClickTime) < 500) {
            canDrag = false;
            ipc.on_open_file_request(entry.stat);
            ipc.play_sound(CLICK_SOUND_PATH);
        } else {
            lastSelectedEntryIndex = index;
            lastClickTime = Date.now();
            canDrag = true;
            draggingEntryIndex = index;

            target.setPointerCapture(event.pointerId);
        }
    };

    const onDesktopEntryPointerMove = (event: PointerEvent, entry: DesktopEntry) => {
        if(!canDrag) return;

        const index = desktopEntries.indexOf(entry);
        if(index === -1) return;

        const deltaX = event.movementX;
        const deltaY = event.movementY;

        let newX = entry.x + deltaX / entryWidth;
        let newY = entry.y + deltaY / entryHeight;

        entry.x = Math.max(0, Math.min(maxColumns - 1, newX));
        entry.y = Math.max(0, Math.min(maxRows - 1, newY));
    };

    const onDesktopEntryPointerUp = (event: PointerEvent, entry: DesktopEntry) => {
        const target = event.target as HTMLElement;
        target.releasePointerCapture(event.pointerId);

        if(canDrag) {
            entry.x = Math.round(entry.x);
            entry.y = Math.round(entry.y);

            const grid = getDesktopGrid(desktopEntries, entry);
            if(grid[entry.x][entry.y]) {
                console.log("is occupied, finding next available cell");
                if(!checkGridCollision(grid, entry.x + 1, entry.y)) {
                    entry.x += 1;
                } else if(!checkGridCollision(grid, entry.x - 1, entry.y)) {
                    entry.x -= 1;
                } else if(!checkGridCollision(grid, entry.x, entry.y + 1)) {
                    entry.y += 1;
                } else if(!checkGridCollision(grid, entry.x, entry.y - 1)) {
                    entry.y -= 1;
                } else {
                    const cell = getNextAvailableCell(desktopEntries);
                    entry.x = cell.x;
                    entry.y = cell.y;
                }
            }
        }

        canDrag = false;
    };
</script>

<main class="desktop" bind:clientWidth={clientWidth} bind:clientHeight={clientHeight} onpointerdown={onDesktopClick}>
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
        <button 
            class="desktop-icon" 
            style:left={(entry.x ?? 0) * entryWidth + "px"} 
            style:top={(entry.y ?? 0) * entryHeight + "px"}
            style:width={entryWidth + "px"} 
            style:height={entryHeight + "px"}
            style:z-index={active && lastSelectedEntryIndex === index ? 1 : 0}

            onpointerdown={(event) => onDesktopEntryPointerDown(event, entry)}
            onpointermove={(event) => onDesktopEntryPointerMove(event, entry)}
            onpointerup={(event) => onDesktopEntryPointerUp(event, entry)}
            onpointercancel={(event) => onDesktopEntryPointerUp(event, entry)}
        >
            <div style="width: 32px; height: 32px; position: relative;">
                <img 
                    src={entry.icon ?? icon_executable_32} 
                    alt="icon" 
                    width={32} 
                    height={32} 
                    style="image-rendering: pixelated; pointer-events: none;" 
                >
                <div style="
                    position: absolute; 
                    inset: 0; 
                    background-color: #000A71; 
                    mask-image: url({entry.icon ?? icon_executable_32}); 
                    mask-repeat: no-repeat; 
                    mask-position: center; 
                    mask-size: cover; 
                    opacity: {active && lastSelectedEntryIndex === index ? 0.5 : 0}; 
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
                class="desktop-icon__label"
                class:desktop-icon__label__selected={active && lastSelectedEntryIndex === index}
                class:desktop-icon__label__selected_full={lastSelectedEntryIndex === index}
            >
                {entry.name.split(".")[0]}
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
        position: absolute;

        display: flex;
        flex-direction: column;
        align-items: center;

        gap: 4px;

        padding-top: 8px;
    }

    .desktop-icon__label__selected {
        border-style: dashed !important;
        border-color: white !important;
    }

    .desktop-icon__label__selected_full {
        background-color: #000A71;
        color: white;
    }

    .desktop-icon__label {
        font-size: 11px;
        line-height: 12px;

        color: white;
        text-align: center;

        border-width: 1px;
        border-style: solid;
        border-color: transparent;

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