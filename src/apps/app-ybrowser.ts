import { Executable, Kernel } from "../yos/core/kernel";
import { XEventType, type X11, type XDisplay, type XWindow } from "../yos/core/x11";

interface yBrowserOptions {
    url: string;

    title?: string;
    icon?: string;

    width?: number;
    height?: number;
}

class yBrowser extends Executable {
    readonly x11: X11;
    
    private _display: XDisplay | null = null;
    private _window: XWindow | null = null;

    constructor(
        readonly kernel: Kernel,
        readonly props: yBrowserOptions
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

        this.x11.changeProperty(this._display, this._window, "_NET_WM_NAME", this.props.title || "yBrowser");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_ICON_NAME", this.props.icon || "");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");
        this.x11.setWindowBackgroundColor(this._display, this._window, "#FFFFFF");

        this.x11.attachContext(this._display, this._window, (root) => {
            const iframe = document.createElement("iframe");

            iframe.src = this.props.url;
            iframe.style.border = "none";
            iframe.style.width = "100%";
            iframe.style.height = "100%";

            root.appendChild(iframe);

            return () => {
                root.removeChild(iframe);
            };
        });

        this.x11.configureWindow(this._display, this._window, {
            x: 100,
            y: 100,
            width: this.props.width ?? 800,
            height: this.props.height ?? 600,
        });

        this.x11.mapWindow(this._display, this._window);
        this.x11.raiseWindow(this._display, this._window);
    }

    onTick(): boolean {
        if(!this._display || !this._window) return false;

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

export { yBrowser };