import { EventEmitter } from "../yos/utils/event-emitter";
import Window from "./Window.svelte";
import { XConfigureRequestMask, XEventMask, XEventType, type X11, type XDisplay, type XEvent, type XWindow } from "../yos/core/x11";
import { Executable, Kernel } from "../yos/core/kernel";
import { createSvelteContext } from "../yos/context/svelte-context";

enum WindowLayer {
    BACKGROUND = 0,
    DESKTOP = 1,
    NORMAL = 2,
    TOP = 3,
    OVERLAY = 4
}

type ManagedClientEvents = {
    "window:active_changed": [handle: XWindow] 
};

export interface ManagedClient {
    frame: XWindow;
    window: XWindow;
    layer: WindowLayer;

    borderWidth: number;
    titlebarHeight: number;

    emitter: EventEmitter<ManagedClientEvents>;
}

class yWM extends Executable {
    readonly x11: X11;

    private _display: XDisplay | null = null;
    private _frames: XWindow[] = [];
    private _clients: Map<number, ManagedClient> = new Map();
    private _layers: { [key in WindowLayer]: ManagedClient[] } = {
        [WindowLayer.BACKGROUND]: [],
        [WindowLayer.DESKTOP]: [],
        [WindowLayer.NORMAL]: [],
        [WindowLayer.TOP]: [],
        [WindowLayer.OVERLAY]: []
    };

    constructor(
        readonly kernel: Kernel
    ) { 
        super(kernel);

        this.x11 = this.kernel.import<X11>("x11")!;
        if(!this.x11) {
            throw new Error("X11 library not found in kernel.");
        }
    }

    onInit() {
        this._display = this.x11.openDisplay();
        this.x11.selectInput(this._display, this.x11.getRootWindow(), XEventMask.SUBSTRUCTURE_REDIRECT | XEventMask.PROPERTY_CHANGE);

        console.log("yWindowManager: Initialized and listening for events on display id " + this._display.id);
    }

    onTick(): boolean {
        if(!this._display) return true;

        let event;
        while(event = this.x11.nextEvent(this._display)) {
            if(event.type === XEventType.MAP_REQUEST) {
                console.log("yWindowManager: MAP_REQUEST event received");
                this._processMapRequest(event);
            } else if(event.type === XEventType.CONFIGURE_REQUEST) {
                console.log("yWindowManager: CONFIGURE_REQUEST event received");
                this._processConfigureRequest(event);
            } else if(event.type === XEventType.PROPERTY_NOTIFY) {
                this._processPropertyNotify(event);
            } else if(event.type === XEventType.DESTROY_NOTIFY) {
                console.log("yWindowManager: DESTROY_NOTIFY event received");
                this._processDestroyNotify(event);
            } else if(event.type === XEventType.UNMAP_NOTIFY) {
                console.log("yWindowManager: UNMAP_NOTIFY event received");
                this._processUnmapNotify(event);
            }
        }

        return false;
    }

    onDestroy(): void {
        if(!this._display) return;

        for(const [, client] of this._clients) {
            const frame = client.frame;
            this.x11.reparentWindow(this._display, client.window, this.x11.getRootWindow(), frame.x, frame.y);
            this.x11.destroyWindow(this._display, frame);
        }

        this.x11.closeDisplay(this._display);
        this._display = null;
    }

    private _processUnmapNotify(event: XEvent) {
        if(!this._display) return;

        console.log(`yWindowManager: Window id ${event.window.id} unampping...`);

        const rootWindow = this.x11.getRootWindow();
        if(rootWindow.props["_NET_ACTIVE_WINDOW"] === event.window) {
            const stackingWindows = this._layers[WindowLayer.NORMAL].map(c => c.window).reverse();
            let newActiveWindow: XWindow | null = null;

            for(let i = 0; i < stackingWindows.length; i++) {
                const candidate = stackingWindows[i];
                if(candidate.id !== event.window.id && candidate.mapped) {
                    newActiveWindow = candidate;
                    break;
                }
            }

            this.x11.changeProperty(this._display, rootWindow, "_NET_ACTIVE_WINDOW", newActiveWindow);
        }

        const client = this._clients.get(event.window.id);
        if(!client) {
            console.log(`yWindowManager: No managed client found for window id ${event.window.id}, ignoring.`);
            return;
        }

        this.x11.unmapWindow(this._display, client.frame);
    }

    private _processDestroyNotify(event: XEvent) {
        if(!this._display) return;

        const client = this._clients.get(event.window.id);
        if(!client) {
            console.log(`yWindowManager: No managed client found for window id ${event.window.id}, ignoring.`);
            return;
        }

        this.x11.destroyWindow(this._display, client.frame);
        this._clients.delete(event.window.id);

        const layerClients = this._layers[client.layer];
        const index = layerClients.findIndex(c => c.window.id === client.window.id);
        if(index !== -1) {
            layerClients.splice(index, 1);
        }

        const clientList = this.x11.getRootWindow().props["_NET_CLIENT_LIST"] || [];
        const clientIndex = clientList.findIndex((w: XWindow) => w.id === event.window.id);
        if(clientIndex !== -1) {
            clientList.splice(clientIndex, 1);
            this.x11.changeProperty(this._display, this.x11.getRootWindow(), "_NET_CLIENT_LIST", clientList);
        }

        //this._updateNetClientList();
        this._syncWindowStacking();
    }

    private _processConfigureRequest(event: XEvent) {
        if(!this._display) return;

        const client = this._clients.get(event.window.id);
        if(!client) {
            console.log(`yWindowManager: No managed client found for window id ${event.window.id}, handing back to X11.`);
            this.x11.configureWindow(this._display, event.window, {
                x: event.x,
                y: event.y,
                width: event.width,
                height: event.height
            });

            return;
        }

        const frame = client.frame;
        const isTransformMask = event.value_mask !== undefined && (
            (event.value_mask & XConfigureRequestMask.X) !== 0 ||
            (event.value_mask & XConfigureRequestMask.Y) !== 0 ||
            (event.value_mask & XConfigureRequestMask.WIDTH) !== 0 ||
            (event.value_mask & XConfigureRequestMask.HEIGHT) !== 0
        );

        const isAboveMask = event.value_mask !== undefined &&
            (event.value_mask & XConfigureRequestMask.ABOVE) !== 0;
        
        if(isTransformMask) {
            this.x11.configureWindow(this._display, frame, {
                x: event.x,
                y: event.y,
                width: event.width ? event.width + client.borderWidth * 2 : undefined,
                height: event.height ? event.height + client.titlebarHeight + client.borderWidth * 2 : undefined
            });
            this.x11.configureWindow(this._display, event.window, {
                width: event.width,
                height: event.height
            });
        } else if(isAboveMask) {
            console.log(`yWindowManager: Raising window id ${event.window.id}`);
            this.x11.changeProperty(this._display, this.x11.getRootWindow(), "_NET_ACTIVE_WINDOW", event.window);
            this._raiseClientWindow(client);
        }
    }

    private _raiseClientWindow(client: ManagedClient) {
        if(!this._display) return;

        const layerClients = this._layers[client.layer];
        const index = layerClients.findIndex(c => c.window.id === client.window.id);
        if(index === -1) {
            console.warn(`yWindowManager: Client window id ${client.window.id} not found in its layer`);
            return;
        }

        layerClients.splice(index, 1);
        layerClients.push(client);

        this._syncWindowStacking();
    }

    private _syncWindowStacking() {
        if(!this._display) return;

        const windowStack = [
            ...this._layers[WindowLayer.BACKGROUND],
            ...this._layers[WindowLayer.DESKTOP],
            ...this._layers[WindowLayer.NORMAL],
            ...this._layers[WindowLayer.TOP],
            ...this._layers[WindowLayer.OVERLAY]
        ].reverse();

        this.x11.restackWindows(this._display, windowStack.map(c => c.frame));
        this.x11.changeProperty(this._display, this.x11.getRootWindow(), "_NET_CLIENT_LIST_STACKING", windowStack.map(c => c.window));
    }

    private _processMapRequest(event: XEvent) {
        if(!this._display) return;

        if(this._clients.has(event.window.id)) {
            const client = this._clients.get(event.window.id)!;
            console.log(`yWindowManager: Window id ${event.window.id} is already managed, just mapping.`);

            if(!client.window.mapped) {
                this.x11.mapWindow(this._display, client.window);
            }

            this.x11.mapWindow(this._display, client.frame);

            return;
        }

        const frame = this.x11.createWindow(this._display, this.x11.getRootWindow());

        const layer = this._netWmWindowTypeToLayer(event.window.props["_NET_WM_WINDOW_TYPE"]);
        const hasDecoration = this._shouldNetWmWindowTypeHaveDecoration(event.window.props["_NET_WM_WINDOW_TYPE"]);

        const client = {
            frame: frame,
            window: event.window,
            layer: layer,
            emitter: new EventEmitter("yWindowManager:ManagedClient"),
            borderWidth: hasDecoration ? 4 : 0,
            titlebarHeight: hasDecoration ? 20 : 0
        } as ManagedClient;
        
        this.x11.selectInput(this._display, frame, XEventMask.SUBSTRUCTURE_REDIRECT | XEventMask.SUBSTRUCTURE_NOTIFY);
        this.x11.changeProperty(this._display, frame, "_NET_WM_NAME", (event.window.props["_NET_WM_NAME"] || "Untitled Window") + " - yFrame");
        this.x11.configureWindow(this._display, frame, {
            width: event.window.width + client.borderWidth * 2,
            height: event.window.height + client.titlebarHeight + client.borderWidth * 2,
            x: event.window.x,
            y: event.window.y
        })

        if(hasDecoration) {
            this.x11.attachContext(this._display, frame, createSvelteContext(Window, {
                kernel: this.kernel,
                x11: this.x11,
                display: this._display,
                frame: frame,
                window: event.window,
                client: client
            }));
        }
        
        this.x11.reparentWindow(this._display, event.window, frame, client.borderWidth, client.titlebarHeight + client.borderWidth);

        event.window.dom.onmousedown = () => {
            if(!this._display) return;

            console.log(`yWindowManager: Window id ${event.window.id} received mousedown, raising.`);
            this.x11.changeProperty(this._display, this.x11.getRootWindow(), "_NET_ACTIVE_WINDOW", event.window);
            this._raiseClientWindow(client);
        }

        this._frames.push(frame);
        this._clients.set(event.window.id, client);
        this._layers[layer].push(client);

        //this._updateNetClientList();
        this._syncWindowStacking();

        this.x11.mapWindow(this._display, frame);
        this.x11.mapWindow(this._display, event.window);

        const clientList = this.x11.getRootWindow().props["_NET_CLIENT_LIST"] || [];

        clientList.push(event.window);
        this.x11.changeProperty(this._display, this.x11.getRootWindow(), "_NET_CLIENT_LIST", clientList);
    }

    private _processPropertyNotify(event: XEvent) {
        if(!this._display) return;

        if(event.property_key === "_NET_ACTIVE_WINDOW") {
            console.log(event);
            console.log("yWindowManager: PROPERTY_NOTIFY event for _NET_ACTIVE_WINDOW received");

            const activeWindow = event.property_value as XWindow;
            if(!activeWindow) {
                console.log("yWindowManager: No active window, skipping.");
                return;
            }
            
            const client = this._clients.get(activeWindow.id);
            if(!client) {
                console.warn(`yWindowManager: No managed client found for window id ${activeWindow.id}`);
                return;
            }

            this._raiseClientWindow(client);
            this._emitEventToClients("window:active_changed", activeWindow);
        }
    }

    private _updateNetClientList() {
        if(!this._display) return;

        const clientList = Array.from(this._clients.values()).filter(c => c.layer === WindowLayer.NORMAL).map(c => c.window);
        this.x11.changeProperty(this._display, this.x11.getRootWindow(), "_NET_CLIENT_LIST", clientList);
    }

    private _emitEventToClients<T extends keyof ManagedClientEvents>(type: T, ...args: ManagedClientEvents[T]) {
        for(const client of this._clients.values()) {
            client.emitter.emit(type, ...args);
        }
    }

    private _shouldNetWmWindowTypeHaveDecoration(type: string): boolean {
        switch(type) {
            case "_NET_WM_WINDOW_TYPE_DESKTOP":
            case "_NET_WM_WINDOW_TYPE_DOCK":
            case "_NET_WM_WINDOW_TYPE_TOOLBAR":
            case "_NET_WM_WINDOW_TYPE_MENU":
            case "_NET_WM_WINDOW_TYPE_UTILITY":
            case "_NET_WM_WINDOW_TYPE_SPLASH":
            case "_NET_WM_WINDOW_TYPE_DIALOG":
            case "_NET_WM_WINDOW_TYPE_DROPDOWN_MENU":
            case "_NET_WM_WINDOW_TYPE_POPUP_MENU":
            case "_NET_WM_WINDOW_TYPE_TOOLTIP":
            case "_NET_WM_WINDOW_TYPE_NOTIFICATION":
            case "_NET_WM_WINDOW_TYPE_COMBO":
            case "_NET_WM_WINDOW_TYPE_DND":
            case "_NET_WM_WINDOW_TYPE_SCREENSAVER":
                return false;
            case "_NET_WM_WINDOW_TYPE_NORMAL":
            default:
                return true;
        }
    }

    private _netWmWindowTypeToLayer(type: string): WindowLayer {
        switch(type) {
            case "_NET_WM_WINDOW_TYPE_DESKTOP":
                return WindowLayer.DESKTOP;
            case "_NET_WM_WINDOW_TYPE_DOCK":
            case "_NET_WM_WINDOW_TYPE_TOOLBAR":
            case "_NET_WM_WINDOW_TYPE_MENU":
            case "_NET_WM_WINDOW_TYPE_UTILITY":
            case "_NET_WM_WINDOW_TYPE_SPLASH":
            case "_NET_WM_WINDOW_TYPE_DIALOG":
            case "_NET_WM_WINDOW_TYPE_DROPDOWN_MENU":
            case "_NET_WM_WINDOW_TYPE_POPUP_MENU":
            case "_NET_WM_WINDOW_TYPE_TOOLTIP":
            case "_NET_WM_WINDOW_TYPE_NOTIFICATION":
            case "_NET_WM_WINDOW_TYPE_COMBO":
            case "_NET_WM_WINDOW_TYPE_DND":
                return WindowLayer.TOP;
            case "_NET_WM_WINDOW_TYPE_SCREENSAVER":
                return WindowLayer.OVERLAY;
            case "_NET_WM_WINDOW_TYPE_NORMAL":
            default:
                return WindowLayer.NORMAL;
        }
    }
}

export { yWM };