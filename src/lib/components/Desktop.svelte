<script lang="ts">
    import DesktopIcon from "$lib/components/DesktopIcon.svelte";
    import img_ext_svg from "$lib/assets/icons/icon_extension_txt.svg";
    import img_snow_png from "$lib/assets/icons/img_snow_simulator.png";
    import icon_match_mayhem from "$lib/assets/icons/icon_match_mayhem.png";
    import Window from "./core/Window.svelte";
    import { WindowStyle } from "./core/WindowStyle";
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

    const DESKTOP_CELL_SIZE = 100;

    let clientWidth: number = $state(0);
    let clientHeight: number = $state(0);

    let readmeOpened: boolean = $state(true);
    let aboutmeOpened: boolean = $state(false);
    let linksOpened: boolean = $state(false);
    let changelogOpened: boolean = $state(false);
    let snowSimulatorOpened: boolean = $state(false);
    let matchMayhemOpened: boolean = $state(false);

    let icons: Icon[] = [
        {
            label: "README",
            icon: img_ext_svg,
            x: gridX(0),
            y: gridY(0),
            onClick: () => readmeOpened = true
        },
        {
            label: "ABOUT ME",
            icon: img_ext_svg,
            x: gridX(1),
            y: gridY(0),
            onClick: () => aboutmeOpened = true
        },
        {
            label: "LINKS",
            icon: img_ext_svg,
            x: gridX(2),
            y: gridY(0),
            onClick: () => linksOpened = true
        },
        {
            label: "CHANGELOG",
            icon: img_ext_svg,
            x: gridX(3),
            y: gridY(0),
            onClick: () => changelogOpened = true
        },
        {
            label: "Snow Simulator",
            icon: img_snow_png,
            x: gridX(0),
            y: gridY(1),
            onClick: () => snowSimulatorOpened = true
        },
        {
            label: "Match Mayhem",
            icon: icon_match_mayhem,
            x: gridX(1),
            y: gridY(1),
            onClick: () => matchMayhemOpened = true
        }
    ];

    let lastFocusedWindow: HTMLDivElement | null = $state(null);

    onMount(() => {
        const handleResize = () => {
            clientWidth = window.innerWidth;
            clientHeight = window.innerHeight;
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    });

    function gridX(x: number) {
        return x * DESKTOP_CELL_SIZE;
    }

    function gridY(y: number) {
        return y * DESKTOP_CELL_SIZE;
    }

    function onFocusRequested(self: HTMLDivElement) {
        if(lastFocusedWindow) {
            lastFocusedWindow.style.zIndex = "0";
        }

        self.style.zIndex = "1";
        lastFocusedWindow = self;
    }
</script>

<Window x={0} y={0} width={clientWidth} height={clientHeight} color="#4A95EA" title="Desktop" style={WindowStyle.NO_BORDER | WindowStyle.NO_TITLE_BAR | WindowStyle.NO_SHADOW}>
    {#each icons as icon (icon.label)}
        <DesktopIcon 
            x={icon.x} y={icon.y} 
            icon={icon.icon} 
            label={icon.label} 
            onClick={icon.onClick}
        />
    {/each}

    {#if readmeOpened}
        <TextReader filename="desktop/README.txt" onFocusRequested={onFocusRequested} onClose={() => readmeOpened = false} />
    {/if}

    {#if aboutmeOpened}
        <TextReader filename="desktop/ABOUT ME.txt" onFocusRequested={onFocusRequested} onClose={() => aboutmeOpened = false} />
    {/if}

    {#if linksOpened}
        <TextReader filename="desktop/LINKS.txt" onFocusRequested={onFocusRequested} onClose={() => linksOpened = false} />
    {/if}

    {#if changelogOpened}
        <TextReader filename="desktop/CHANGELOG.txt" onFocusRequested={onFocusRequested} onClose={() => changelogOpened = false} />
    {/if}

    {#if snowSimulatorOpened}
        <SnowSimulator focusRequested={onFocusRequested} closeRequested={() => snowSimulatorOpened = false} />
    {/if}

    {#if matchMayhemOpened}
        <Browser 
            url="https://y3v4d.com/match3d" icon={icon_match_mayhem} 
            title="Match Mayhem"
            focusRequested={onFocusRequested} closeRequested={() => matchMayhemOpened = false}
        />
    {/if}

    <div class="absolute bottom-1 right-2 text-white text-sm">
        © 2025 Y3V4D
    </div>
</Window>