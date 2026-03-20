<script lang="ts" module>
    export interface WindowIPC {
        on_active_window_changed?: (id: number) => void;
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";

    import icon_default_16 from "./assets/executable_16.png";
    import icon_btn_close from "./assets/btn_close.png";
    import icon_btn_minimize from "./assets/btn_minimize.png";
    import icon_btn_maximize from "./assets/btn_maximize.png";
    import icon_btn_unmaximize from "./assets/btn_unmaximize.png";
    import Button from "./button.svelte";

    interface WindowProps {
        x11: any;
        display: any;
        client: any;
        isOnMobileDevice: boolean;
    }

    let {
        x11,
        display,
        client,
        isOnMobileDevice
    }: WindowProps = $props();

    let title = $state("");
    let icon = $state(icon_default_16);
    let focused = $state(false);
    let maximized = $state(false);
    let lastGeometry = $state<{ x: number; y: number; width: number; height: number } | null>(null);

    function unmaximize() {
        if(!lastGeometry) return;

        x11.configureWindow(display, client.frame, {
            x: lastGeometry.x,
            y: lastGeometry.y,
            width: lastGeometry.width,
            height: lastGeometry.height
        });

        x11.configureWindow(display, client.window, {
            width: lastGeometry.width - client.borderWidth * 2,
            height: lastGeometry.height - client.titlebarHeight - client.borderWidth * 2
        });

        maximized = false;
    }
    
    const onCloseButtonClick = () => {
        x11.sendEvent(display, client.window, {
            type: 99,
            windowId: client.window.id,
            
            client_message_type: "WM_DELETE_WINDOW"
        });
    };

    const onMinimizeButtonClick = () => {
        x11.unmapWindow(display, client.window);
    };

    const onMaximizeButtonClick = async () => {
        if(maximized) {
            unmaximize();
            return;
        }

        lastGeometry = await x11.getGeometry(display, client.frame);

        const clients = await x11.getProperty(display, x11.getRootWindow(display), "_NET_CLIENT_LIST") || [];
        const workArea = {
            x: 0,
            y: 0,
            width: x11.getDisplayWidth(display),
            height: x11.getDisplayHeight(display)
        };

        for(const client of clients) {
            const strut = await x11.getProperty(display, client, "_NET_WM_STRUT") || { left: 0, right: 0, top: 0, bottom: 0 };
            workArea.x += strut.left;
            workArea.y += strut.top;
            workArea.width -= strut.left + strut.right;
            workArea.height -= strut.top + strut.bottom;
        }

        x11.configureWindow(display, client.frame, {
            x: workArea.x,
            y: workArea.y,
            width: workArea.width,
            height: workArea.height
        });

        x11.configureWindow(display, client.window, {
            width: workArea.width - client.borderWidth * 2,
            height: workArea.height - client.titlebarHeight - client.borderWidth * 2
        });

        maximized = true;
    };

    let pointerOffsetX: number;
    let pointerOffsetY: number;

    const onTitlebarPointerDown = async (event: PointerEvent) => {
        if(isOnMobileDevice) {
            return;
        }
        
        const target = event.currentTarget as HTMLElement;

        const geometry = await x11.getGeometry(display, client.frame);

        pointerOffsetX = event.clientX - geometry.x;
        pointerOffsetY = event.clientY - geometry.y;

        target.setPointerCapture(event.pointerId);
    }

    const onTitlebarPointerMove = async (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement;
        if(!target.hasPointerCapture(event.pointerId)) {
            return;
        }

        if(maximized) {
            unmaximize();
            const geometry = await x11.getGeometry(display, client.frame);
            pointerOffsetX = event.clientX - geometry.x;
            pointerOffsetY = event.clientY - geometry.y;
        }

        const newX = event.clientX - pointerOffsetX;
        const newY = event.clientY - pointerOffsetY;

        x11.configureWindow(display, client.frame, {
            x: newX, 
            y: newY
        });
    };

    const onTitlebarPointerUp = (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement;
        target.releasePointerCapture(event.pointerId);
    };

    const onWindowPointerDown = () => {
        x11.changeProperty(display, x11.getRootWindow(display), "_NET_ACTIVE_WINDOW", client.window);
    };

    onMount(() => {
        if(!parent) {
            throw new Error("Window has no parent!");
        }
        
        init();

        client.ipc.on_active_window_changed = (id: number) => {
            focused = id === client.window.id;
        };
    });

    const init = async () => {
        title = await x11.getProperty(display, client.window, "_NET_WM_NAME") || "Untitled Window";
        icon = await x11.getProperty(display, client.window, "_NET_WM_ICON") || icon_default_16;

        const activeWindow = await x11.getProperty(display, x11.getRootWindow(display), "_NET_ACTIVE_WINDOW");
        focused = activeWindow?.id === client.window.id;
    }
</script>

<div 
    id="window-{client.frame.id}--svelte"
    class="decoration"
    class:panel-raised={true}

    tabindex={0}
    role="dialog"

    onpointerdown={onWindowPointerDown}
>
    <div 
        class="title-bar"
        class:title-bar--inactive={!focused}
        onpointerdown={onTitlebarPointerDown}
        onpointermove={onTitlebarPointerMove}
        onpointerup={onTitlebarPointerUp}
        onpointercancel={onTitlebarPointerUp}
    >
        <img class="title-bar__icon" src={icon} alt="Window Icon" />
        <span class="title-bar__title">
            {title}
        </span>
        <Button onclick={onMinimizeButtonClick}>
            <img src={icon_btn_minimize} alt="Minimize Button" width="10px" height="10px" style="image-rendering: pixelated; margin: 0px 1px;" />
        </Button>
        {#if !isOnMobileDevice}
            <Button onclick={onMaximizeButtonClick}>
                <img 
                    src={maximized ? icon_btn_unmaximize : icon_btn_maximize} 
                    alt={maximized ? "Unmaximize Button" : "Maximize Button"} width="10px" height="10px" style="image-rendering: pixelated; margin: 0px 1px;" />
            </Button>
        {/if}
        <div style="width: 2px;"></div>
        <Button onclick={onCloseButtonClick}>
            <img src={icon_btn_close} alt="Close Button" style="image-rendering: pixelated; margin: 1px 2px 2px 2px;" />
        </Button>
    </div>
    <div style="flex-grow: 1"></div>
</div>

<style>
    .decoration {
        display: flex;
        flex-direction: column;

        width: 100%;
        height: 100%;

        padding: 4px;
        box-sizing: border-box;

        -webkit-user-select: none;
        -moz-user-select: none;
        user-select: none;
    }

    .title-bar {
        display: flex;
        align-items: center;

        height: 20px;
        padding-right: 2px;
        padding-left: 3px;

        margin: 0px 0px 1px 0px;

        color: white;
        cursor: move;

        background: linear-gradient(to right, #000080, #1084D0);
        font-weight: bold;
    }

    .title-bar__icon {
        width: 16px;
        height: 16px;

        image-rendering: pixelated;
        margin-right: 3px;
    }

    .title-bar__title {
        color: white;

        flex-grow: 1;
        text-align: left;

        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }

    .title-bar--inactive {
        background: linear-gradient(to right, #808080, #B5B5B5);
    }
</style>