import AppYDesktop, { type DesktopEntry, type DesktopIPC, type WindowTreeNode } from "./app-ydesktop.svelte";
import { createSvelteContext } from "../yos/context/svelte-context";
import { Executable, Kernel, KernelEventQueue } from "../yos/core/kernel";
import { XEventMask, XEventType, type X11, type XDisplay, type XWindow } from "../yos/core/x11";
import PathUtils from "../yos/utils/path-utils";
import type { DirEntry } from "../yos/core/vfs";

import icon_txt_32 from "../assets/icons/icon_txt_32.png";
import { VfsFormtUtils } from "../yos/utils/vfs-utils";

class yDesktop extends Executable {
    readonly x11: X11;

    private _display: XDisplay | null = null;
    private _window: XWindow | null = null;
    private _kernelEvents: KernelEventQueue | null = null;

    private _ipc: DesktopIPC = {
        on_context_mount: () => {
            this._ipc.update_entry_size?.(80, 80);
            this._ipc.update_files?.(this._getDesktopFiles());
            this._ipc.update_tree?.(this._buildWindowTree());
            this._ipc.update_processes?.(this.kernel.listProcesses());
        },

        on_desktop_click: () => {
            if(!this._display) return;
            if(!this._window) return;

            this.x11.changeProperty(this._display, this.x11.getRootWindow(), "_NET_ACTIVE_WINDOW", this._window);
        },

        on_open_file_request: (stat) => {
            const path = "/home/y3v4d/desktop/" + stat.name;

            const ext = PathUtils.extname(stat.name).slice(1);
            if(ext === "exe") {
                this.kernel.execve(path);
            } else if(ext === "txt") {
                this.kernel.execve(path, { filename: path });
            }
        },

        play_sound: (soundPath: string) => {
            this.kernel.audio.play(soundPath);
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

        this.x11.selectInput(this._display, rootWindow, XEventMask.SUBSTRUCTURE_NOTIFY | XEventMask.PROPERTY_CHANGE);
        this.x11.configureWindow(this._display, this._window, {
            width: rootWindow.width,
            height: rootWindow.height - 29,
            x: 0,
            y: 0
        });

        this.x11.changeProperty(this._display, this._window, "_NET_WM_NAME", "yDesktop");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_DESKTOP");

        this.x11.setWindowBackgroundColor(this._display, this._window, "#008080");
        this.x11.attachContext(this._display, this._window, createSvelteContext(AppYDesktop, {
            ipc: this._ipc
        }));

        this.x11.mapWindow(this._display, this._window);
    }

    onTick() {
        if(!this._display) return false;
        if(!this._kernelEvents) return false;

        let kernelEvent;
        let process_updated = false;
        let file_updated = false;
        while(kernelEvent = this._kernelEvents.next()) {
            if(kernelEvent.type === "process:spawned" || kernelEvent.type === "process:killed") {
                process_updated = true;
            } else if(kernelEvent.type === "file:created") {
                const parent = PathUtils.dirname(kernelEvent.path);
                if(parent === "/home/y3v4d/desktop") {
                    file_updated = true;
                }
            }
        }

        let event;
        while(event = this.x11.nextEvent(this._display)) {
            if(event.type === XEventType.PROPERTY_NOTIFY) {
                if(event.property_key === "_NET_ACTIVE_WINDOW") {
                    const activeWindow = event.property_value as XWindow;
                    const isActive = activeWindow === this._window;

                    this._ipc.update_active?.(isActive);
                }
            } else if(event.type !== XEventType.CONFIGURE_NOTIFY) {
                this._ipc.update_tree?.(this._buildWindowTree());
            }
        }

        if(process_updated) {
            this._ipc.update_processes?.(this.kernel.listProcesses());
        }

        if(file_updated) {
            this._ipc.update_files?.(this._getDesktopFiles());
        }

        return false;
    }

    onDestroy() {
        if(this._kernelEvents) {
            this.kernel.unsubscribe(this._kernelEvents);
        }

        if(this._display) {
            if(this._window) {
                this.x11.destroyWindow(this._display, this._window);
            }

            this.x11.closeDisplay(this._display);
        }
        
        this._kernelEvents = null;
        this._display = null;
        this._window = null;
    }

    private _buildWindowTree() {
        if(!this._display) throw new Error("Display not initialized");

        const rootWindow = this.x11.getRootWindow();
        const activeWindow = rootWindow.props["_NET_ACTIVE_WINDOW"] || null;

        const rootNode: WindowTreeNode = {
            self: rootWindow,
            children: [],
            active: rootWindow === activeWindow
        };

        const build = (node: WindowTreeNode) => {
            const tree = this.x11.queryTree(this._display!, node.self);
            for(const child of tree.children) {
                const childNode: WindowTreeNode = {
                    self: child,
                    children: [],
                    active: child === activeWindow
                };
                node.children.push(childNode);
                
                build(childNode);
            }
        }

        build(rootNode);
        return rootNode;
    }

    private _getDesktopFiles() {
        try {
            const dir = this.kernel.vfs.opendir("/home/y3v4d/desktop");
            const files: DirEntry[] = [];

            let file;
            while(file = this.kernel.vfs.readdir(dir)) {
                files.push(file);
            }

            return files.map(file => {
                const entry: DesktopEntry = {
                    name: file.name,
                    ext: PathUtils.extname(file.name).slice(1),
                    type: file.type === 1 ? "directory" : "file",
                    stat: file,
                    x: -1,
                    y: -1
                };

                if(entry.ext === "exe") {
                    const formatUtils = new VfsFormtUtils(this.kernel.vfs);

                    const path = "/home/y3v4d/desktop/" + entry.name;
                    const { executable, icon } = formatUtils.readExecutable(path);

                    entry.icon = icon ? icon : undefined;
                } else if(entry.ext === "txt") {
                    entry.icon = icon_txt_32;
                } else {
                    entry.icon = undefined;
                }

                return entry;
            })
        } catch(e) {
            console.error("Failed to read desktop directory:", e);
            return [];
        }
    }
}

export { yDesktop };