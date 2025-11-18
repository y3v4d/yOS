<script lang="ts">
    import DesktopIcon from "$lib/components/DesktopIcon.svelte";
    import img_ext_svg from "$lib/assets/icons/icon_extension_txt.svg";
    import img_snow_png from "$lib/assets/icons/img_snow_simulator.png";
    import Window from "./core/Window.svelte";
    import { WindowStyle } from "./core/WindowStyle";
    import { onMount } from "svelte";
    import TextReader from "./TextReader.svelte";
    import SnowSimulator from "./SnowSimulator.svelte";

    let clientWidth: number = $state(0);
    let clientHeight: number = $state(0);

    let readmeOpened: boolean = $state(true);
    let aboutmeOpened: boolean = $state(false);
    let linksOpened: boolean = $state(false);
    let changelogOpened: boolean = $state(false);
    let snowSimulatorOpened: boolean = $state(false);

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

    function onFocusRequested(self: HTMLDivElement) {
        if(lastFocusedWindow) {
            lastFocusedWindow.style.zIndex = "0";
        }

        self.style.zIndex = "1";
        lastFocusedWindow = self;
    }
</script>

<Window x={0} y={0} width={clientWidth} height={clientHeight} color="#4A95EA" title="Desktop" style={WindowStyle.NO_BORDER | WindowStyle.NO_TITLE_BAR | WindowStyle.NO_SHADOW}>
    <DesktopIcon icon={img_ext_svg} label="README" onClick={() => readmeOpened = true} />
    <DesktopIcon icon={img_ext_svg} label="ABOUT ME" onClick={() => aboutmeOpened = true} />
    <DesktopIcon icon={img_ext_svg} label="LINKS" onClick={() => linksOpened = true} />
    <DesktopIcon icon={img_ext_svg} label="CHANGELOG" onClick={() => changelogOpened = true} />
    <DesktopIcon icon={img_snow_png} label="Snow Simulator" onClick={() => snowSimulatorOpened = true} />

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

    <div class="absolute bottom-1 right-2 text-white text-sm">
        © 2025 Y3V4D
    </div>
</Window>