<script lang="ts" module>
    import { onMount } from 'svelte';
    import type { Process } from '../yos';

    export interface TaskManagerIPC {
        update_applications?: (applications: ApplicationInfo[]) => void;
        update_processes?: (processes: Process[]) => void;

        on_context_mount: () => void;
    }

    export interface ApplicationInfo {
        windowId: number;
        title: string;
        icon?: string;
    }
</script>

<script lang="ts">
    import icon_default_16 from '../assets/icons/executable_16.png';
    import PathUtils from '../yos/utils/path-utils';

    interface TaskManagerParams {
        ipc: TaskManagerIPC;
    }

    let {
        ipc
    }: TaskManagerParams = $props();

    let applications = $state<ApplicationInfo[]>([]);
    let processes = $state<Process[]>([]);
    
    onMount(() => {
        ipc.update_applications = (apps) => {
            applications = apps;
        };

        ipc.update_processes = (procs) => {
            processes = procs;
        };

        ipc.on_context_mount();
    });

    type Tab = "applications" | "processes" | "performance";
    let tab: Tab = $state("applications");
</script>

<main class="container">
    <!-- Menu Bar -->
    <section class="menu-bar">
        <button class="menu-bar-button">
            File
        </button>
        <button class="menu-bar-button">
            Options
        </button>
        <button class="menu-bar-button">
            Help
        </button>
    </section>
    <div class="separator-horizontal"></div>
    <section class="content">
        <nav class="content-nav">
            {#snippet nav_button(group: Tab, label: string)}
                <button
                    class="content-nav-item"
                    class:content-nav-item--selected={tab === group}
                    onclick={() => tab = group}
                >
                    {label}
                </button>
            {/snippet}
            
            {@render nav_button("applications", "Applications")}
            {@render nav_button("processes", "Processes")}
            
        </nav>
        <div class="content-box-wrapper">
            <div class="content-box">
                {#if tab === "applications"}
                    <div class="content-box-header">
                        <div class="panel-raised">Task</div>
                        <div class="panel-raised">Status</div>
                    </div>
                    <div class="content-box-content-wrapper no-scrollbar">
                        <div class="content-box-content">
                            {#each applications as app}
                                <div class="content-box-row">
                                    <div class="application-entry">
                                        <img src={app.icon ? app.icon : icon_default_16} alt="icon" width="16" height="16" style="image-rendering: pixelated;" />
                                        <p>{app.title}</p>
                                    </div>
                                    
                                    <div class="application-status">
                                        <p>
                                            Running
                                        </p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {:else if tab === "processes"}
                    <div class="content-box-header">
                        <div class="panel-raised">Image Name</div>
                        <div class="panel-raised">PID</div>
                    </div>
                    <div class="content-box-content no-scrollbar">
                        {#each processes as process}
                            {@const exeName = PathUtils.basename(process.path || "") || "Unnammed Executable"}
                            <div class="content-box-row">
                                <div class="process-name">{exeName}</div>
                                <div class="process-pid">{process.pid}</div>
                            </div>
                        {/each}
                    </div>
                {:else if tab === "performance"}
                    <p style="padding: 4px;">Performance metrics would go here.</p>
                {/if}
            </div>
        </div>
    </section>
</main>

<style>
    .container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;

        background-color: #C0C0C0;
    }

    .process-name {
        padding-left: 4px;
    }

    .process-pid {
        padding-right: 4px;
        text-align: right;
    }

    .application-entry {
        display: flex;
        flex-direction: row;
        align-items: center;

        padding-left: 4px;
        gap: 4px;
    }

    .application-status {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding-left: 8px;
    }

    .content-box-content-wrapper {
        flex-grow: 1;
        overflow: auto;
        overscroll-behavior: none;
    }

    .content-box-content {
        display: flex;
        flex-direction: column;

        overflow: auto;
        overscroll-behavior: none;
    }

    .content-box-row {
        display: grid;
        grid-template-columns: 3fr 1fr;

        padding: 2px 0px;
    }

    .content-box-header {
        display: grid;
        grid-template-columns: 3fr 1fr;
    }

    .content-box-header > div {
        padding: 4px 8px;
    }

    .content {
        flex-grow: 1;
        overflow: hidden;

        display: flex;
        flex-direction: column;

        padding: 8px;
    }

    .content-nav {
        display: flex;
        flex-direction: row;

        align-items: end;

        padding-left: 2px;

        z-index: 1;
    }

    .content-nav-item {
        padding: 4px 8px;

        background-color: #C0C0C0;

        box-shadow:
            1px 1px 0px 0px #FFFFFF inset,
            -1px 0px #404040 inset,
            -2px 0px #808080 inset; 

        line-height: 12px;

        border-bottom: 1px solid white;
    }

    .content-nav-item--selected {
        padding: 5px 9px;
        z-index: 1;

        margin-left: -2px;
        border-bottom: 1px solid #C0C0C0;
    }

    .content-nav-item--selected:not(:last-child) {
        margin-right: -2px;
    }

    .content-box-wrapper {
        flex-grow: 1;
        overflow: hidden;

        padding: 12px;

        box-shadow: 
            1px 0px #ffffff inset,
            -1px -1px #404040 inset,
            -2px -2px #808080 inset,
            0px -1px #ffffff;
    }

    .content-box {
        width: 100%;
        height: calc(100% - 24px);

        overflow: hidden;

        display: flex;
        flex-direction: column;

        background-color: white;
        padding: 2px;

        box-shadow: 
            -1px -1px #ffffff inset,
            
            1px 1px #808080 inset,
            -2px -2px #C0C0C0 inset,
            2px 2px #404040 inset;
    }

    .menu-bar {
        background-color: #C0C0C0;

        width: 100%;
        height: 18px;
        min-height: 18px;
    }

    .menu-bar-button {
        height: 100%;

        background-color: #C0C0C0;

        margin: 0px;
        padding: 2px 6px 2px 6px;

        font-size: 11px;
        cursor: pointer;
    }

    .separator-horizontal {
        width: 100%;
        height: 2px;
        min-height: 2px;

        background-color: #808080;
        box-shadow:
            0px -1px #FFFFFF inset,
            0px 1px #808080 inset;

        box-sizing: border-box;
    }

    .pixel-corners {
        clip-path: polygon(
            /* bottom edge — flat */
            0px 100%,
            100% 100%,

            /* right edge up */
            100% 1px,
            calc(100% - 1px) 1px,
            calc(100% - 1px) 0px,

            /* top edge */
            1px 0px,
            1px 1px,
            0px 1px
        );
    }
</style>