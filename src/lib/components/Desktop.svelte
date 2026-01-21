<script lang="ts">
    import DesktopIcon from "$lib/components/DesktopIcon.svelte";
    import icon_notepad_32 from "$lib/assets/icons/icon_notepad_32.png";
    import icon_notepad_16 from "$lib/assets/icons/icon_notepad_16.png";
    import img_snow_png from "$lib/assets/icons/img_snow_simulator.png";
    import icon_match_mayhem from "$lib/assets/icons/icon_match_mayhem.png";
    import icon_voxelly from "$lib/assets/icons/icon_voxelly.png";
    import { onMount, type Component } from "svelte";
    import TextReader from "./TextReader.svelte";
    import SnowSimulator from "./SnowSimulator.svelte";
    import Browser from "./Browser.svelte";
    import { getOSContext, type Executable } from "$lib/contexts/OSContext";
    import Button from "./core/Button.svelte";

    interface Icon<T extends Record<string, any> = any> {
        x: number,
        y: number,
        icon_32: string,
        icon_16: string,
        label: string,
        executable: Executable<T>
    }

    interface TaskbarItem {
        process_id: number;
        label: string;
        icon: string;
    }

    const DESKTOP_CELL_SIZE_X = 64;
    const DESKTOP_CELL_SIZE_Y = 80;

    let clientWidth: number = $state(0);
    let clientHeight: number = $state(0);

    let contentWidth: number = $state(0);
    let contentHeight: number = $state(0);

    let startMenuElement: HTMLDivElement | null = $state(null);
    let startButtonElement: HTMLButtonElement | null = $state(null);
    let startMenuOpened: boolean = $state(false);

    let timestamp: number = $state(Date.now());

    const context = getOSContext();
    let taskbar = $state<TaskbarItem[]>([]);

    const icons = [
        {
            label: "README",
            icon_16: icon_notepad_16,
            icon_32: icon_notepad_32,
            x: gridX(0),
            y: gridY(0),
            executable: {
                component: TextReader,
                params: {
                    filename: "desktop/README.txt"
                }
            }
        },
        {
            label: "ABOUT ME",
            icon_16: icon_notepad_16,
            icon_32: icon_notepad_32,
            x: gridX(1),
            y: gridY(0),
            executable: {
                component: TextReader,
                params: {
                    filename: "desktop/ABOUT ME.txt"
                }
            }
        },
        {
            label: "LINKS",
            icon_16: icon_notepad_16,
            icon_32: icon_notepad_32,
            x: gridX(2),
            y: gridY(0),
            executable: {
                component: TextReader,
                params: {
                    filename: "desktop/LINKS.txt"
                }
            }
        },
        {
            label: "CHANGELOG",
            icon_16: icon_notepad_16,
            icon_32: icon_notepad_32,
            x: gridX(3),
            y: gridY(0),
            executable: {
                component: TextReader,
                params: {
                    filename: "desktop/CHANGELOG.txt"
                }
            }
        },
        {
            label: "CREDITS",
            icon_16: icon_notepad_16,
            icon_32: icon_notepad_32,
            x: gridX(4),
            y: gridY(0),
            executable: {
                component: TextReader,
                params: {
                    filename: "desktop/CREDITS.txt"
                }
            }
        },
        {
            label: "Snow Simulator",
            icon_16: img_snow_png,
            icon_32: img_snow_png,
            x: gridX(2),
            y: gridY(1),
            executable: {
                component: SnowSimulator
            }
        },
        {
            label: "Match Mayhem",
            icon_16: icon_match_mayhem,
            icon_32: icon_match_mayhem,
            x: gridX(1),
            y: gridY(1),
            executable: {
                component: Browser,
                params: {
                    url: "https://y3v4d.com/match3d",
                    title: "Match Mayhem",
                    icon: icon_match_mayhem
                }
            }
        },
        {
            label: "Voxelly",
            icon_16: icon_voxelly,
            icon_32: icon_voxelly,
            x: gridX(0),
            y: gridY(1),
            executable: {
                component: Browser,
                params: {
                    url: "https://y3v4d.com/voxelly",
                    title: "Voxelly",
                    icon: icon_voxelly,
                    width: 800,
                    height: 600
                }
            }
        }
    ] satisfies Icon[];

    let lastFocusedWindow: HTMLDivElement | null = $state(null);

    onMount(() => {
        const handleResize = () => {
            clientWidth = window.innerWidth;
            clientHeight = window.innerHeight;
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        const interval = setInterval(() => {
            timestamp = Date.now();
        }, 1000);

        const process = context.spawnExecutable({
            component: TextReader,
            params: {
                filename: "desktop/README.txt"
            }
        });
        taskbar = [...taskbar, {
            process_id: process.id,
            label: "README",
            icon: icon_notepad_16,
        }];

        return () => {
            clearInterval(interval);

            window.removeEventListener("resize", handleResize);
        };
    });

    function gridX(x: number) {
        return DESKTOP_CELL_SIZE_X / 2 + x * DESKTOP_CELL_SIZE_X;
    }

    function gridY(y: number) {
        return DESKTOP_CELL_SIZE_Y / 2 + y * DESKTOP_CELL_SIZE_Y;
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

        return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
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

<div class="w-full h-full bg-[#008080] overflow-hidden select-none relative" style="line-height: 12px;">
    <div class="w-full h-full relative overflow-hidden flex flex-col">
        <main class="relative grow" bind:clientWidth={contentWidth} bind:clientHeight={contentHeight}>
            {#each icons as icon (icon.label)}
                <DesktopIcon 
                    x={icon.x} y={icon.y} 
                    icon={icon.icon_32} 
                    label={icon.label} 
                    onClick={() => {
                        const process = context.spawnExecutable<any>(icon.executable);
                        taskbar = [...taskbar, {
                            process_id: process.id,
                            label: icon.label,
                            icon: icon.icon_16,
                        }];
                    }}
                />
            {/each}

            {#each context.getProcesses() as process (process.id)}
                <process.executable.component 
                    {...process.executable.params} 
                    maximizeRequested={onMaximizeRequested} 
                    focusRequested={onFocusRequested} 
                    closeRequested={() => {
                        taskbar = taskbar.filter(item => item.process_id !== process.id);
                        context.killProcess(process.id);
                    }}
                />
            {/each}

            <div class="absolute bottom-1 right-2 text-black font-semibold">
                © 2026 y3v4d
            </div>
        </main>
        <div class="panel-raised flex w-full items-center select-none" style="padding: 3px;">
            <Button onclick={() => startMenuOpened = !startMenuOpened} style="padding: 3px 5px 3px 3px; min-width: fit-content;">
                <div class="flex items-center justify-center gap-0.5">
                    <img src="/logo.png" alt="yOS Logo" class="h-4 w-4" style="image-rendering: pixelated;"/>
                    <p>Start</p>
                </div>
            </Button>
            <div class="separator"></div>
            <div class="grow overflow-hidden">
                <div class="flex gap-1">
                    {#each taskbar as item (item.process_id)}
                        <button class="panel-raised taskbar-button min-w-fit">
                            <img src={item.icon} alt="icon" class="w-4 h-4" style="image-rendering: pixelated;" />
                            <p>{item.label}</p>
                        </button>
                    {/each}
                </div>
            </div>
            <div class="separator"></div>
            <div class="clockbar" style="min-width: fit-content;">
                <span class="leading-3">{parseHour(timestamp)}</span>
                <span class="leading-3">{parseDate(timestamp)}</span>
            </div>

            {#if startMenuOpened}
                <div bind:this={startMenuElement} class="absolute left-0 bottom-7 w-64 h-96 panel-raised z-50">

                </div>
            {/if}
        </div>
    </div>
</div>

<style lang="postcss">
    @reference "$src/app.css";

    .clockbar {
        background-color: #C0C0C0;

        display: flex;
        align-items: center;
        gap: 4px;

        padding: 5px 6px;

        box-shadow: -1px -1px #DFDFDF inset,
                    1px 1px #808080 inset;

        color: black;
    }

    .separator {
        width: 2px;
        height: 21px;

        margin: 0px 3px 1px 3px;

        box-shadow: -1px 0px #FFFFFF inset,
                    1px 0px #808080 inset;
    }

    .taskbar-button {
        display: flex;
        align-items: center;

        gap: 3px;
        padding: 3px 5px 3px 3px;

        color: black;

    }
</style>