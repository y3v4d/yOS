import icon_svelte_16 from "../assets/icons/icon_svelte_16.png";
import AppSvelteContextDemo from "./app-svelte-context-demo.svelte";
import { Executable, Kernel } from "../yos/core/kernel";
import { XEventType, type X11, type XDisplay, type XWindow } from "../yos/core/x11";
import { createSvelteContext } from "../yos/context/svelte-context";

class SvelteContextDemo extends Executable {
    readonly x11: X11;

    private _display: XDisplay | null = null;
    private _window: XWindow | null = null;

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
        this._window = this.x11.createWindow(this._display, this.x11.getRootWindow());

        this.x11.changeProperty(this._display, this._window, "_NET_WM_NAME", "Svelte 5 Context Demo");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_ICON", icon_svelte_16);
        this.x11.changeProperty(this._display, this._window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");

        this.x11.setWindowBackgroundColor(this._display, this._window, "#F0F0F0");
        this.x11.configureWindow(this._display, this._window, {
            x: 16,
            y: 16
        });

        this.x11.attachContext(this._display, this._window, createSvelteContext(AppSvelteContextDemo, {}));
        this.x11.mapWindow(this._display, this._window);
        this.x11.raiseWindow(this._display, this._window);
    }

    onTick(): boolean {
        if(!this._display) return false;
        if(!this._window) return false;

        let event;
        while(event = this.x11.nextEvent(this._display)) {
            if(event.type === XEventType.CLIENT_MESSAGE) {
                if(event.client_message_type === "WM_DELETE_WINDOW") {
                    return true;
                }
            }
        }

        return false;
    }

    onDestroy(): void {
        if(!this._display) return;

        if(this._window) {
            this.x11.destroyWindow(this._display, this._window);
            this._window = null;
        }

        this.x11.closeDisplay(this._display);
        this._display = null;
    }
        
}

export { SvelteContextDemo };