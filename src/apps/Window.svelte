<script lang="ts">
    import { onMount } from "svelte";

    import icon_default_16 from "../assets/icons/executable_16.png";
    import icon_btn_close from "../assets/icons/btn_close.png";
    import icon_btn_minimize from "../assets/icons/btn_minimize.png";
    import icon_btn_maximize from "../assets/icons/btn_maximize.png";
    import icon_btn_unmaximize from "../assets/icons/btn_unmaximize.png";
    import Button from "./Button.svelte";
    import type { ManagedClient } from "./app-ywm";
    import type { Kernel } from "../yos/core/kernel";
    import { XEventType, type X11, type XDisplay, type XWindow } from "../yos/core/x11";

    interface WindowProps {
        kernel: Kernel;
        x11: X11;
        display: XDisplay;
        frame: XWindow;
        window: XWindow;
        client: ManagedClient;
    }

    let {
        kernel,
        x11,
        display,
        frame,
        window,
        client
    }: WindowProps = $props();

    let title = $state("");
    let icon = $state(icon_default_16);
    let focused = $state(false);
    let maximized = $state(false);
    let lastGeometry = $state<{ x: number; y: number; width: number; height: number } | null>(null);
    
    const onCloseButtonClick = () => {
        x11.sendEvent(display, window, {
            type: XEventType.CLIENT_MESSAGE,
            display: display,
            window: window,
            
            client_message_type: "WM_DELETE_WINDOW"
        });
    };

    const onMinimizeButtonClick = () => {
        x11.unmapWindow(display, window);
    };

    const onMaximizeButtonClick = () => {
        if(maximized) {
            if(!lastGeometry) return;

            x11.configureWindow(display, frame, {
                x: lastGeometry.x,
                y: lastGeometry.y,
                width: lastGeometry.width,
                height: lastGeometry.height
            });

            x11.configureWindow(display, window, {
                width: lastGeometry.width - client.borderWidth * 2,
                height: lastGeometry.height - client.titlebarHeight - client.borderWidth * 2
            });

            maximized = false;
            return;
        }

        lastGeometry = {
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height
        };

        const clients = x11.getRootWindow().props["_NET_CLIENT_LIST"] || [];
        const workArea = {
            x: 0,
            y: 0,
            width: x11.rootDOM.clientWidth,
            height: x11.rootDOM.clientHeight
        };

        console.log("Prev work area:", workArea);

        for(const client of clients) {
            const strut = client.props["_NET_WM_STRUT"] || { left: 0, right: 0, top: 0, bottom: 0 };
            console.log(client);
            workArea.x += strut.left;
            workArea.y += strut.top;
            workArea.width -= strut.left + strut.right;
            workArea.height -= strut.top + strut.bottom;
        }

        console.log("Work area:", workArea);

        x11.configureWindow(display, frame, {
            x: workArea.x,
            y: workArea.y,
            width: workArea.width,
            height: workArea.height
        });

        x11.configureWindow(display, window, {
            width: workArea.width - client.borderWidth * 2,
            height: workArea.height - client.titlebarHeight - client.borderWidth * 2
        });

        maximized = true;
    };

    let pointerOffsetX: number;
    let pointerOffsetY: number;

    const onTitlebarPointerDown = (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement;

        pointerOffsetX = event.clientX - frame.x;
        pointerOffsetY = event.clientY - frame.y;

        target.setPointerCapture(event.pointerId);
    }

    const onTitlebarPointerMove = (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement;
        if(!target.hasPointerCapture(event.pointerId)) {
            return;
        }

        const newX = event.clientX - pointerOffsetX;
        const newY = event.clientY - pointerOffsetY;

        x11.configureWindow(display, frame, {
            x: newX, 
            y: newY
        });
    };

    const onTitlebarPointerUp = (event: PointerEvent) => {
        const target = event.currentTarget as HTMLElement;
        target.releasePointerCapture(event.pointerId);
    };

    const onWindowPointerDown = () => {
        console.log("Window pointer down");
        x11.changeProperty(display, x11.getRootWindow(), "_NET_ACTIVE_WINDOW", window);
    };

    const onWindowActiveChanged = (win: XWindow) => {
        focused = win == window;
    };

    onMount(() => {
        if(!parent) {
            throw new Error("Window has no parent!");
        }
        
        title = window.props["_NET_WM_NAME"] || "Untitled Window";
        icon = window.props["_NET_WM_ICON"] || icon_default_16;
        focused = x11.getRootWindow().props["_NET_ACTIVE_WINDOW"] == window;

        client.emitter.on("window:active_changed", onWindowActiveChanged);

        return () => {
            client.emitter.off("window:active_changed", onWindowActiveChanged);
        };
    });
</script>

<div 
    id="window-{frame.id}--svelte"
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
        <Button onclick={onMaximizeButtonClick}>
            <img 
                src={maximized ? icon_btn_unmaximize : icon_btn_maximize} 
                alt={maximized ? "Unmaximize Button" : "Maximize Button"} width="10px" height="10px" style="image-rendering: pixelated; margin: 0px 1px;" />
        </Button>
        <div style="width: 2px;"></div>
        <Button onclick={onCloseButtonClick}>
            <img src={icon_btn_close} alt="Close Button" style="image-rendering: pixelated; margin: 1px 2px 2px 2px;" />
        </Button>
    </div>
    <div class="content-decoration"></div>
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

    .content-decoration {
        flex-grow: 1;
    }

    .title-bar {
        display: flex;
        align-items: center;

        height: 20px;
        padding-right: 2px;
        padding-left: 3px;

        margin: 0px 0px 0px 0px;

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