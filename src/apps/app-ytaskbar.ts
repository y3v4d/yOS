import { EventEmitter } from "../yos/utils/event-emitter";
import AppYTaskbar, { type yTaskbarAPI } from "./app-ytaskbar.svelte";
import { Executable, Kernel } from "../yos/core/kernel";
import { XEventMask, XEventType, type X11, type XDisplay, type XWindow } from "../yos/core/x11";
import { createSvelteContext } from "../yos/context/svelte-context";

class yTaskbar extends Executable {
    readonly x11: X11;
    
    private _display: XDisplay | null = null;
    private _window: XWindow | null = null;

    private _emitter = new EventEmitter<yTaskbarAPI>("yTaskbar-emitter");

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
        const rootWindow = this.x11.getRootWindow();

        this._display = this.x11.openDisplay();
        this._window = this.x11.createWindow(this._display, rootWindow);

        this.x11.selectInput(this._display, rootWindow, XEventMask.PROPERTY_CHANGE);

        this.x11.changeProperty(this._display, this._window, "_NET_WM_NAME", "yTaskbar");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_DOCK");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_STRUT", {
            left: 0,
            right: 0,
            top: 0,
            bottom: 29
        });
        this.x11.setWindowBackgroundColor(this._display, this._window, "#202020");

        this.x11.attachContext(this._display, this._window, createSvelteContext(AppYTaskbar, {
            kernel: this.kernel,
            x11: this.x11,
            display: this._display,
            emitter: this._emitter
        }));

        this.x11.mapWindow(this._display, this._window);
        this.x11.configureWindow(this._display, this._window, {
            width: rootWindow.width,
            height: 29,
            x: 0,
            y: rootWindow.height - 29
        });
    }

    onTick() {
        if(!this._display) return false;
        if(!this._window) return false;

        let event;
        while(event = this.x11.nextEvent(this._display)) {
            if(event.type === XEventType.PROPERTY_NOTIFY) {
                const key = event.property_key;
                if(key === "_NET_CLIENT_LIST") {
                    const clientList = event.property_value as XWindow[];
                    this._emitter.emit("clients:updated", clientList.filter(client => client.props["_NET_WM_WINDOW_TYPE"] === "_NET_WM_WINDOW_TYPE_NORMAL"));
                } else if(key === "_NET_ACTIVE_WINDOW") {
                    const activeWindow = event.property_value as XWindow;
                    this._emitter.emit("active:updated", activeWindow);
                }
            }
        }

        return false;
    }

    onDestroy() {
        if(!this._display) return;

        if(this._window) {
            this.x11.destroyWindow(this._display, this._window);
            this._window = null;
        }

        this.x11.closeDisplay(this._display);
        this._display = null;
    }
}

export { yTaskbar };