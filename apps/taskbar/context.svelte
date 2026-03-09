<script lang="ts" module>
    export type yTaskbarAPI = {
        on_items_updated?: (items: { id: number, title: string, icon: string | null }[]) => void;
        on_active_updated?: (active: any) => void;

        on_mounted: () => void;
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import Button from "./button.svelte";

    import icon_default_16 from "./assets/executable_16.png";

    interface TaskbarProps {
        api: yTaskbarAPI;

        x11: any;
        display: any;
    }

    let {
        api,
        x11,
        display,
    }: TaskbarProps = $props();

    let contentElement: HTMLDivElement = $state<HTMLDivElement>(null!);
    let timestamp = $state(Date.now());
    let taskbar = $state<{ id: number, title: string, icon: string | null }[]>([]);
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

    onMount(() => {
        api.on_items_updated = (items: { id: number, title: string, icon: string | null }[]) => {
            taskbar = items;
        };

        api.on_active_updated = (active: any) => {
            activeWindowId = active?.id ?? -1;
        };

        api.on_mounted();
    });

    const onTaskbarItemClick = async (item: any) => {
        await x11.mapWindow(display, { id: item.id });
        await x11.changeProperty(display, x11.getRootWindow(display), "_NET_ACTIVE_WINDOW", { id: item.id });
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
        {#each taskbar as item (item.id)}
            <button 
                class="panel-raised taskbar-button"
                class:panel-lowered={item.id == activeWindowId}
                style="min-width: fit-content;"

                onclick={() => onTaskbarItemClick(item)}
            >
                <img src={item.icon || icon_default_16} alt="icon" width="16px" height="16px" style="image-rendering: pixelated;" />
                
                {#if !shouldHideNames}
                    <p>{item.title || "Untitled Window"}</p>
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