<script lang="ts">
    import DesktopIcon from "$lib/components/DesktopIcon.svelte";
    import img_ext_svg from "$lib/assets/icons/icon_extension_txt.svg";
    import Window from "./core/Window.svelte";
    import { WindowStyle } from "./core/WindowStyle";
    import { onMount } from "svelte";
    import TextReader from "./TextReader.svelte";

    let clientWidth: number = $state(0);
    let clientHeight: number = $state(0);

    let readmeOpened: boolean = $state(true);
    let aboutmeOpened: boolean = $state(false);
    let linksOpened: boolean = $state(false);
    let changelogOpened: boolean = $state(false);

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
    <DesktopIcon icon={img_ext_svg} label="README !!!" onClick={() => readmeOpened = true} />
    <DesktopIcon icon={img_ext_svg} label="ABOUT ME" onClick={() => aboutmeOpened = true} />
    <DesktopIcon icon={img_ext_svg} label="LINKS" onClick={() => linksOpened = true} />
    <DesktopIcon icon={img_ext_svg} label="CHANGELOG" onClick={() => changelogOpened = true} />

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

    <div class="absolute bottom-1 right-2 text-white text-sm">
        © 2025 Y3V4D
    </div>
</Window>

<!--<div class="absolute inset-0 bg-[#4A95EA]">
    <DesktopIcon icon={img_ext_svg} label="README"></DesktopIcon>

    <Window x={100} y={100} width={400} height={300} title="Text Reader - README" icon={img_ext_svg}>
        <p>Home Terminal v0.1 </p>
        <p>--------------------</p>
        <p>Welcome to my portfolio website! This site is a digital showcase of my projects, skills, and experiences as a developer.</p>
        <p>Feel free to explore and learn more about me and my work.</p>
        <br /> 
        <p>Status: Work In Progress</p>
        <p>Updates will roll out as I upload new projects.</p>
    </Window>

    <div class="absolute bottom-2 right-4 text-white text-sm">
        © 2025 Y3V4D
    </div>
</div>-->