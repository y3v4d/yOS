<script lang="ts" module>
    export type yTaskbarAPI = {
        "clients:updated": [clients: XWindow[]]
        "active:updated": [activeWindow: XWindow]
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import Button from "./Button.svelte";

    import icon_default_16 from "../assets/icons/executable_16.png";
    import type { EventEmitter } from "../yos/utils/event-emitter";
    import type { Kernel } from "../yos/core/kernel";
    import type { X11, XDisplay, XWindow } from "../yos/core/x11";

    interface TaskbarProps {
        kernel: Kernel;
        x11: X11;
        display: XDisplay;
        
        emitter: EventEmitter<yTaskbarAPI>;
    }

    let {
        kernel,
        x11,
        display,
        emitter
    }: TaskbarProps = $props();

    let contentElement: HTMLDivElement = $state<HTMLDivElement>(null!);
    let timestamp = $state(Date.now());
    let taskbar = $state<number[]>([]);
    let activeWindowId: number = $state(-1);
    let shouldHideNames = $state(false);
    let hideWhenLessThan = $state(0);

    $effect(() => {
        taskbar;
        if(contentElement) {
            if(!shouldHideNames) {
                shouldHideNames = contentElement.scrollWidth > contentElement.clientWidth;
                if(shouldHideNames) {
                    hideWhenLessThan = taskbar.length;
                }
            } else if(taskbar.length < hideWhenLessThan) {
                shouldHideNames = false;
            }
        }
    });

    $inspect("shouldHideNames", shouldHideNames);

    onMount(() => {
        taskbar = (x11.getRootWindow().props["_NET_CLIENT_LIST"] as any[])?.filter(client => client.props["_NET_WM_WINDOW_TYPE"] === "_NET_WM_WINDOW_TYPE_NORMAL").map((win: XWindow) => win.id) || [];
        activeWindowId = x11.getRootWindow().props["_NET_ACTIVE_WINDOW"]?.id || -1;

        emitter.on("clients:updated", onClientsUpdated);
        emitter.on("active:updated", onActiveUpdated);

        return () => {
            emitter.off("clients:updated", onClientsUpdated);
            emitter.off("active:updated", onActiveUpdated);
        };
    });

    const onClientsUpdated = (clients: XWindow[]) => {
        taskbar = clients.map(win => win.id);

    };

    const onActiveUpdated = (active: XWindow) => {
        activeWindowId = active?.id ?? -1;
    };

    const onTaskbarWindowClick = (window: XWindow) => {
        if(!window.mapped) {
            x11.mapWindow(display, window);
        }

        x11.changeProperty(display, x11.getRootWindow(), "_NET_ACTIVE_WINDOW", window);
    };

    function parseHour(timestamp: number) {
        const date = new Date(timestamp);
        let hours = date.getHours();

        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        if (hours == 0) {
            hours = 12;
        }

        return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    function parseDate(timestamp: number) {
        const date = new Date(timestamp);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        return `${day}/${month}/${date.getFullYear().toString().slice(-2)}`;
    }
</script>

<div class="panel-raised taskbar">
    <Button style="padding: 3px 5px 3px 3px; min-width: fit-content;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
            <img src="/logo_16.png" alt="yOS Logo" width="16" height="16" style="image-rendering: pixelated;"/>
            <div>Start</div>
        </div>
    </Button>
    <div class="separator"></div>
    <div class="separator"></div>
    <div class="resizer"></div>
    <div class="content no-scrollbar" bind:this={contentElement}>
        {#each taskbar as id (id)}
            {@const window = x11.getWindow(display, id)}

            <button 
                class="panel-raised taskbar-button"
                class:panel-lowered={window.id == activeWindowId}
                style="min-width: fit-content;"

                onclick={() => onTaskbarWindowClick(window)}
            >
                <img src={window.props["_NET_WM_ICON"] || icon_default_16} alt="icon" width="16px" height="16px" style="image-rendering: pixelated;" />
                
                {#if !shouldHideNames}
                    <p>{window.props["_NET_WM_NAME"] || "Untitled Window"}</p>
                {/if}
            </button>
        {/each}
    </div>
    <div class="separator"></div>
    <div class="clockbar panel-lowered" style="min-width: fit-content;">
        <span class="leading-3">{parseHour(timestamp)}</span>
        <span class="leading-3">{parseDate(timestamp)}</span>
    </div>
</div>

<style>
    .taskbar {
        width: 100%;
        height: 100%;

        display: flex;
        align-items: center;

        padding: 3px;
        gap: 4px;

        box-sizing: border-box;
    }

    .clockbar {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 0px 6px 0px 6px;
        height: 23px;
    }

    .taskbar-button {
        display: flex;
        align-items: center;
        gap: 4px;

        padding: 0px 6px 0px 4px;

        height: 23px;
        min-width: fit-content;

        box-sizing: border-box;
    }

    .content {
        display: flex;
        align-items: center;
        gap: 2px;

        flex-grow: 1;
        overflow: hidden;
        overscroll-behavior: none;
    }

    .separator {
        width: 2px;
        min-width: 2px;
        height: 21px;

        margin-bottom: 1px;

        box-shadow: -1px 0px #FFFFFF inset,
                    1px 0px #808080 inset;
    }

    .resizer {
        background-color: #C0C0C0;

        width: 3px;
        min-width: 3px;
        height: 18px;

        box-shadow: 0px -1px #808080 inset,
                    1px 0px #FFFFFF inset,
                    0px 1px #FFFFFF inset,
                    -1px 0px #808080 inset;
    }
</style>