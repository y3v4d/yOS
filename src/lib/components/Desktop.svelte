<script lang="ts">
    import DesktopIcon from "$lib/components/DesktopIcon.svelte";
    import icon_ext_txt from "$lib/assets/icons/icon_extension_txt.png";
    import img_snow_png from "$lib/assets/icons/img_snow_simulator.png";
    import icon_match_mayhem from "$lib/assets/icons/icon_match_mayhem.png";
    import icon_voxelly from "$lib/assets/icons/icon_voxelly.png";
    import { onMount } from "svelte";
    import TextReader from "./TextReader.svelte";
    import SnowSimulator from "./SnowSimulator.svelte";
    import Browser from "./Browser.svelte";

    interface Icon {
        x: number,
        y: number,
        icon: string,
        label: string,
        onClick: () => void
    }

    const DESKTOP_CELL_SIZE_X = 80;
    const DESKTOP_CELL_SIZE_Y = 100;

    let clientWidth: number = $state(0);
    let clientHeight: number = $state(0);

    let contentWidth: number = $state(0);
    let contentHeight: number = $state(0);

    let startMenuElement: HTMLDivElement | null = $state(null);
    let startButtonElement: HTMLButtonElement | null = $state(null);
    let startMenuOpened: boolean = $state(false);

    let timestamp: number = $state(Date.now());

    let readmeOpened: boolean = $state(true);
    let aboutmeOpened: boolean = $state(false);
    let linksOpened: boolean = $state(false);
    let changelogOpened: boolean = $state(false);
    let snowSimulatorOpened: boolean = $state(false);
    let matchMayhemOpened: boolean = $state(false);
    let voxellyOpened: boolean = $state(false);

    let icons: Icon[] = [
        {
            label: "README",
            icon: icon_ext_txt,
            x: gridX(0),
            y: gridY(0),
            onClick: () => readmeOpened = true
        },
        {
            label: "ABOUT ME",
            icon: icon_ext_txt,
            x: gridX(1),
            y: gridY(0),
            onClick: () => aboutmeOpened = true
        },
        {
            label: "LINKS",
            icon: icon_ext_txt,
            x: gridX(2),
            y: gridY(0),
            onClick: () => linksOpened = true
        },
        {
            label: "CHANGELOG",
            icon: icon_ext_txt,
            x: gridX(3),
            y: gridY(0),
            onClick: () => changelogOpened = true
        },
        {
            label: "Snow Simulator",
            icon: img_snow_png,
            x: gridX(2),
            y: gridY(1),
            onClick: () => snowSimulatorOpened = true
        },
        {
            label: "Match Mayhem",
            icon: icon_match_mayhem,
            x: gridX(1),
            y: gridY(1),
            onClick: () => matchMayhemOpened = true
        },
        {
            label: "Voxelly",
            icon: icon_voxelly,
            x: gridX(0),
            y: gridY(1),
            onClick: () => voxellyOpened = true
        }
    ];

    let lastFocusedWindow: HTMLDivElement | null = $state(null);

    onMount(() => {
        const handleResize = () => {
            clientWidth = window.innerWidth;
            clientHeight = window.innerHeight;
        };

        const onGlobalClick = (event: Event) => {
            const isOnStartButton = startButtonElement && (event.target == startButtonElement || startButtonElement.contains(event.target as Node));
            const isOnStartMenu = startMenuElement && (event.target == startMenuElement || startMenuElement.contains(event.target as Node));

            if(!isOnStartButton && !isOnStartMenu) {
                startMenuOpened = false;
            }
        }

        document.addEventListener("mousedown", onGlobalClick);
        window.addEventListener("resize", handleResize);
        handleResize();

        const interval = setInterval(() => {
            timestamp = Date.now();
        }, 1000);

        return () => {
            clearInterval(interval);

            document.removeEventListener("mousedown", onGlobalClick);
            window.removeEventListener("resize", handleResize);
        };
    });

    function gridX(x: number) {
        return x * DESKTOP_CELL_SIZE_X;
    }

    function gridY(y: number) {
        return y * DESKTOP_CELL_SIZE_Y;
    }

    function parseHour(timestamp: number) {
        const date = new Date(timestamp);
        let hours = date.getHours();

        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        if (hours === 0) {
            hours = 12;
        }

        return `${hours}:${minutes.toString().padStart(2, '0')}${ampm}`;
    }

    function parseDate(timestamp: number) {
        const date = new Date(timestamp);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        return `${day}/${month}/${date.getFullYear().toString().slice(-2)}`;
    }

    function onMaximizeRequested(self: HTMLDivElement, isMaximized: boolean) {
        /*if(isMaximized) {
            self.style.width = `${contentWidth}px`;
            self.style.height = `${contentHeight}px`;
            self.style.left = `0px`;
            self.style.top = `0px`;
        } else {
            self.style.width = `800px`;
            self.style.height = `600px`;
            self.style.left = `${Math.floor((contentWidth - 800) / 2)}px`;
            self.style.top = `${Math.floor((contentHeight - 600) / 2)}px`;
        }*/
        
    }

    function onFocusRequested(self: HTMLDivElement) {
        if(lastFocusedWindow) {
            lastFocusedWindow.style.zIndex = "0";
        }

        self.style.zIndex = "1";
        lastFocusedWindow = self;
    }
</script>

<div class="w-full h-full bg-[#4A95EA] overflow-hidden font-mono text-xs select-none relative">
    <div class="w-full h-full relative overflow-hidden flex flex-col">
        <main class="relative grow" bind:clientWidth={contentWidth} bind:clientHeight={contentHeight}>
            {#each icons as icon (icon.label)}
                <DesktopIcon 
                    x={icon.x} y={icon.y} 
                    icon={icon.icon} 
                    label={icon.label} 
                    onClick={icon.onClick}
                />
            {/each}

            {#if readmeOpened}
                <TextReader filename="desktop/README.txt" maximizeRequested={onMaximizeRequested} focusRequested={onFocusRequested} closeRequested={() => readmeOpened = false} />
            {/if}

            {#if aboutmeOpened}
                <TextReader filename="desktop/ABOUT ME.txt" maximizeRequested={onMaximizeRequested} focusRequested={onFocusRequested} closeRequested={() => aboutmeOpened = false} />
            {/if}

            {#if linksOpened}
                <TextReader filename="desktop/LINKS.txt" maximizeRequested={onMaximizeRequested} focusRequested={onFocusRequested} closeRequested={() => linksOpened = false} />
            {/if}

            {#if changelogOpened}
                <TextReader filename="desktop/CHANGELOG.txt" maximizeRequested={onMaximizeRequested} focusRequested={onFocusRequested} closeRequested={() => changelogOpened = false} />
            {/if}

            {#if snowSimulatorOpened}
                <SnowSimulator maximizeRequested={onMaximizeRequested} focusRequested={onFocusRequested} closeRequested={() => snowSimulatorOpened = false} />
            {/if}

            {#if matchMayhemOpened}
                <Browser 
                    url="https://y3v4d.com/match3d" icon={icon_match_mayhem} 
                    title="Match Mayhem"
                    maximizeRequested={onMaximizeRequested} focusRequested={onFocusRequested} closeRequested={() => matchMayhemOpened = false}
                />
            {/if}

            {#if voxellyOpened}
                <Browser
                    url="https://y3v4d.com/voxelly"
                    title="Voxelly" icon={icon_voxelly}
                    width={800} height={600}
                    maximizeRequested={onMaximizeRequested} focusRequested={onFocusRequested} closeRequested={() => voxellyOpened = false}
                />
            {/if}

            <div class="absolute bottom-1 right-2 text-xs text-[#1762B7] font-semibold">
                © 2025 y3v4d
            </div>
        </main>
        <div class="bg-[#C0C0C0] h-9 border-t-white border-t-2 text-white items-center flex select-none relative">
            <button 
                bind:this={startButtonElement}
                class="h-8 px-0.5 cursor-pointer active:scale-95"
                onclick={() => startMenuOpened = !startMenuOpened}
            >
                <img src="/logo.png" alt="yOS Logo" class="h-full w-auto"/>
            </button>
            <div class="grow"></div>
            <div class="flex items-center gap-1 mx-1 h-7 px-1.5  text-black box-inverted">
                <span class="text-xxs leading-3">{parseHour(timestamp)}</span>
                <span class="text-xxs leading-3">{parseDate(timestamp)}</span>
            </div>

            {#if startMenuOpened}
                <div bind:this={startMenuElement} class="absolute left-0 bottom-8 w-64 h-96 box !border-l-0 z-50">

                </div>
            {/if}
        </div>
    </div>
</div>