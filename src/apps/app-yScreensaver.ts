import { Executable, Kernel } from "../yos/core/kernel";
import type { X11, XDisplay, XWindow } from "../yos/core/x11";

class yScreensaver extends Executable {
    readonly x11: X11;

    private _display: XDisplay = null!;
    private _window: XWindow = null!;

    private _isActive: boolean = false;

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

        const rootWindow = this.x11.getRootWindow();

        this._window = this.x11.createWindow(this._display, rootWindow);

        this.x11.setWindowBackgroundColor(this._display, this._window, "#000000");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_NAME", "yScreensaver");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_SCREENSAVER");

        this.x11.configureWindow(this._display, this._window, {
            x: 0,
            y: 0,
            width: rootWindow.width,
            height: rootWindow.height
        });

        this.x11.mapWindow(this._display, this._window);
        this._isActive = true;
    }

    onTick() {
        if(!this._display) return false;
        if(!this._window) return false;

        if(document.hidden && !this._isActive) {
            this.x11.mapWindow(this._display, this._window);
            this._isActive = true;
        } else if(!document.hidden && this._isActive) {
            this.x11.unmapWindow(this._display, this._window);
            this._isActive = false;
        }

        return false;
    }

    onDestroy(): void {
        if(!this._display) return;

        if(this._window) {
            this.x11.destroyWindow(this._display, this._window);
            this._window = null!;
        }

        this.x11.closeDisplay(this._display);
        this._display = null!;
    }
}

export { yScreensaver };