import context from "./context.svelte";
import icon_txt_32 from "./assets/icon_txt_32.png";

const x11 = include("y11");
const svelte = include("svelte");
const utils = include("utils");

let display;
let window;
let kernelEvents;

export default async function(args) {
    const ipc = {
        on_context_mount: async () => {
            ipc.update_entry_size?.(80, 80);
            ipc.update_files?.(await getDesktopFiles());
            ipc.update_processes?.(kernel.listProcesses());
        },

        on_desktop_click: () => {
            if(!display) return;
            if(!window) return;

            x11.changeProperty(display, x11.getRootWindow(display), "_NET_ACTIVE_WINDOW", window);
        },

        on_open_file_request: async (stat) => {
            const path = "/home/y3v4d/desktop/" + stat.name;

            const ext = utils.path.extname(stat.name).slice(1);
            if(ext === "exe") {
                await kernel.execve(path);
            } else if(ext === "lnk") {
                const formatUtils = new utils.vfsFormat(kernel.vfs);
                const { targetPath, icon, props } = await formatUtils.readShortcut(path);
                const targetExt = utils.path.extname(targetPath).slice(1);

                if(targetExt === "exe") {
                    await kernel.execve(targetPath, props);
                } else if(targetExt === "txt") {
                    await kernel.execve("/etc/applications/notepad.exe", targetPath);
                }
            } else if(ext === "txt") {
                await kernel.execve("/etc/applications/notepad.exe", path);
            }
        },

        play_sound: (soundPath) => {
            kernel.audio.play(soundPath);
        }
    }

    kernelEvents = kernel.subscribe();
    display = await x11.openDisplay();

    const rootWindow = x11.getRootWindow(display);
    window = await x11.createWindow(display, rootWindow);

    await x11.selectInput(display, rootWindow, 4 | 16);
    await x11.selectInput(display, window, 8); // STRUCTURE_NOTIFY so i can attach context only when window is for sure mapped
    await x11.configureWindow(display, window, {
        width: rootWindow.width,
        height: rootWindow.height - 29,
        x: 0,
        y: 0
    });

    await x11.changeProperty(display, window, "_NET_WM_NAME", "yDesktop");
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_DESKTOP");

    await x11.changeWindowBackgroundColor(display, window, "#008080");
    await x11.mapWindow(display, window);

    let has_context = false;
    let should_close = false;
    while(!should_close) {
        let kernelEvent;
        let process_updated = false;
        let file_updated = false;

        while(kernelEvent = kernelEvents.next()) {
            if(kernelEvent.type === "process:spawned" || kernelEvent.type === "process:killed") {
                process_updated = true;
            } else if(kernelEvent.type === "file:created") {
                const parent = utils.path.dirname(kernelEvent.path);
                if(parent === "/home/y3v4d/desktop") {
                    file_updated = true;
                }
            }
        }

        let event;
        while(event = x11.nextEvent(display)) {
            if(event.type === 6) {
                if(event.property_key === "_NET_ACTIVE_WINDOW") {
                    const activeWindow = event.property_value;
                    const isActive = activeWindow === window;

                    ipc.update_active?.(isActive);
                }
            } else if(event.type === 4) {
                if(event.window.id === window.id && !has_context) {
                    /*
                        i only want to attach the context after the desktop window is actually mapped,
                        because if WM is running, it intercepts the map request, which means that
                        initial mapping of the desktop window is not done after getting ack from
                        the server. attaching the context before causes intial calculations for the
                        desktop layout to be done using the wrong window size, because window size
                        is read from the svelte dom bindings.
                    */
                    console.log("Received map notify event for desktop window, attaching context..."); 
                    x11.attachContext(window, svelte.createContext(context, {
                        ipc: ipc
                    }));
                    has_context = true;
                }
            }
        }

        if(process_updated) {
            ipc.update_processes?.(kernel.listProcesses());
        }

        if(file_updated) {
            ipc.update_files?.(await getDesktopFiles());
        }

        await kernel.yield();
    }

    kernel.unsubscribe(kernelEvents);
    await x11.destroyWindow(display, window);
    x11.closeDisplay(display);

    async function getDesktopFiles() {
        try {
            const dir = await kernel.vfs.opendir("/home/y3v4d/desktop");
            const files = [];

            let file;
            while(file = kernel.vfs.readdir(dir)) {
                files.push(file);
            }

            const mapped = [];
            for(const file of files) {
                const entry = {
                    name: file.name,
                    ext: utils.path.extname(file.name).slice(1),
                    type: file.type === 1 ? "directory" : "file",
                    stat: file,
                    x: -1,
                    y: -1
                };

                if(entry.ext === "exe") {
                    const formatUtils = new utils.vfsFormat(kernel.vfs);

                    const path = "/home/y3v4d/desktop/" + entry.name;
                    //const { executable, icon } = formatUtils.readExecutable(path);

                    entry.icon = icon ? icon : undefined;
                } else if(entry.ext === "lnk") {
                    const formatUtils = new utils.vfsFormat(kernel.vfs);

                    const path = "/home/y3v4d/desktop/" + entry.name;
                    const { targetPath, icon, props } = await formatUtils.readShortcut(path);
                    const targetExt = utils.path.extname(targetPath).slice(1);

                    if(icon) {
                        entry.icon = icon;
                    } else {
                        if(targetExt === "exe") {
                            //const { executable, icon } = formatUtils.readExecutable(targetPath);
                            //entry.icon = icon ? icon : undefined;
                        } else if(targetExt === "txt") {
                            entry.icon = icon_txt_32;
                        } else {
                            entry.icon = undefined;
                        }
                    }
                } else if(entry.ext === "txt") {
                    entry.icon = icon_txt_32;
                } else {
                    entry.icon = undefined;
                }
                
                mapped.push(entry);
            }

            return mapped;
        } catch(e) {
            console.error("Failed to read desktop directory:", e);
            return [];
        }
    }
}