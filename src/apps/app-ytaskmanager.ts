import { createSvelteContext, Executable, Kernel, KernelEventQueue, X11, XDisplay, XEventMask, XEventType, type XWindow } from "../yos";
import AppYtaskmanager, { type ApplicationInfo, type TaskManagerIPC } from "./app-ytaskmanager.svelte";
import icon_taskmanager_16 from "../assets/icons/icon_taskmanager_16.png";

class yTaskManager extends Executable {
    readonly x11: X11;

    private _display: XDisplay = null!;
    private _window: XWindow = null!;

    private _kernelEvents: KernelEventQueue = null!;

    private _ipc: TaskManagerIPC = {
        on_context_mount: () => {
            this._ipc.update_processes?.(this.kernel.listProcesses());

            const rootWindow = this.x11.getRootWindow();
            const clients = (rootWindow.props["_NET_CLIENT_LIST"] as XWindow[]).filter(client => client.props["_NET_WM_WINDOW_TYPE"] === "_NET_WM_WINDOW_TYPE_NORMAL") || [];
            const applications: ApplicationInfo[] = clients.map(client => this._windowToAppInfo(client));

            this._ipc.update_applications?.(applications);
        },

        on_kill_process: (pid: number) => {
            this.kernel.killProcess(pid);
        },

        on_kill_application: (windowId: number) => {
            const rootWindow = this.x11.getRootWindow();
            const clients = rootWindow.props["_NET_CLIENT_LIST"] as XWindow[] || [];
            const targetClient = clients.find(client => client.id === windowId);
            if(targetClient) {
                this.x11.sendEvent(this._display, targetClient, {
                    window: targetClient,
                    display: this._display,
                    
                    type: XEventType.CLIENT_MESSAGE,
                    client_message_type: "WM_DELETE_WINDOW"
                });
            }
        }
    }

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
        this._kernelEvents = this.kernel.subscribe();
        this._display = this.x11.openDisplay();

        const rootWindow = this.x11.getRootWindow();
        this._window = this.x11.createWindow(this._display, rootWindow);

        this.x11.selectInput(this._display, rootWindow, XEventMask.PROPERTY_CHANGE);

        this.x11.changeProperty(this._display, this._window, "_NET_WM_NAME", "yTaskManager");

        this.x11.changeProperty(this._display, this._window, "_NET_WM_ICON", icon_taskmanager_16);
        this.x11.changeProperty(this._display, this._window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");

        this.x11.setWindowBackgroundColor(this._display, this._window, "#FFFFFF");
        this.x11.configureWindow(this._display, this._window, {
            width: 400,
            height: 400,
            x: 100,
            y: 100
        });

        this.x11.attachContext(this._display, this._window, createSvelteContext(AppYtaskmanager, {
            ipc: this._ipc
        }))

        this.x11.mapWindow(this._display, this._window);
        this.x11.raiseWindow(this._display, this._window);
    }

    onTick() {
        if(!this._display) return false;
        if(!this._window) return false;

        let kernelEvent;
        while(kernelEvent = this._kernelEvents.next()) {
            if(kernelEvent.type === "process:spawned" || kernelEvent.type === "process:killed") {
                this._ipc.update_processes?.(this.kernel.listProcesses());
            }
        }

        let event;
        while(event = this.x11.nextEvent(this._display)) {
            if(event.type === XEventType.CLIENT_MESSAGE) {
                if(event.client_message_type === "WM_DELETE_WINDOW") {
                    return true;
                }
            } else if(event.type === XEventType.PROPERTY_NOTIFY) {
                if(event.property_key === "_NET_CLIENT_LIST") {
                    const clients = event.property_value as XWindow[];
                    const applications: ApplicationInfo[] = clients.filter(client => client.props["_NET_WM_WINDOW_TYPE"] === "_NET_WM_WINDOW_TYPE_NORMAL").map(client => this._windowToAppInfo(client));
                    this._ipc.update_applications?.(applications);
                }
            }
        }

        return false;
    }

    onDestroy() {
        if(!this._kernelEvents) return;
        if(!this._display) return;

        this.kernel.unsubscribe(this._kernelEvents);
        this._kernelEvents = null!;

        if(this._window) {
            this.x11.destroyWindow(this._display, this._window);
            this._window = null!;
        }

        this.x11.closeDisplay(this._display);
        this._display = null!;
    }

    private _windowToAppInfo(window: XWindow): ApplicationInfo {
        return {
            windowId: window.id,
            title: window.props["_NET_WM_NAME"] || "Unknown",
            icon: window.props["_NET_WM_ICON"] || null
        }
    }
}

export { yTaskManager };