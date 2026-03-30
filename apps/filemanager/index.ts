import context, { Entry, IPC } from "./context.svelte";

import icon_txt_32 from "./assets/icon_txt_32.png";
import icon_executable_32 from "./assets/icon_executable_32.png";
import icon_directory_32 from "./assets/icon_directory_32.png";
import icon_unknown_32 from "./assets/icon_unknown_32.png";
import icon_filemanager_16 from "./assets/icon_filemanager_16.png";

enum FsNotifyEventType {
    CREATE      = 0b00000001,
    DELETE      = 0b00000010,
    MODIFY      = 0b00000100,
    RENAME      = 0b00001000,
    DELETE_SELF = 0b00010000,
    ISDIR       = 0b00100000
}

type DirEntry = {
    inode: number;
    type: number;

    name: string;
}

const x11 = include("y11");
const svelte = include("svelte");
const utils = include("utils");

let display: any;

export default async function() {
    const ipc = {
        on_context_mount: async () => {
            console.log("Context mounted, sending initial data...");
            await openDirectory("/");
        },

        on_navigate: async (path: string) => {
            path = utils.path.normalize(path);

            const stat = await kernel.vfs.stat(path);
            if(stat.type === 1) {
                await openDirectory(path);
            } else {
                await openFile(path);
            }
        }
    } as IPC;
    
    display = await x11.openDisplay();

    const rootWindow = x11.getRootWindow(display);
    const window = await x11.createWindow(display, rootWindow);

    await x11.selectInput(display, window, 8); // STRUCTURE_NOTIFY

    await x11.changeProperty(display, window, "_NET_WM_NAME", "yFileManager");
    await x11.changeProperty(display, window, "_NET_WM_ICON", icon_filemanager_16);
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");

    await x11.changeWindowBackgroundColor(display, window, "#FFFFFF");
    await x11.configureWindow(display, window, {
        width: 640,
        height: 400,
        x: 100,
        y: 100
    });

    await x11.mapWindow(display, window);
    await x11.raiseWindow(display, window);

    const inotify_fd = kernel.vfs.inotify_create();

    let homeWatcher = async function() {
        while(!should_close) {
            let raw;
            try {
                raw = await kernel.vfs.read(inotify_fd, 1024);
            } catch (e) {
                console.error("Error reading from inotify fd:", e);
                break;
            }

            const decoded = new TextDecoder().decode(raw);
            const events = JSON.parse(decoded);

            for(const event of events) {
                console.log("Filesystem event:", event);
            }
        }
    }

    let currentPath = "";
    let openDirectory = async function(path: string) {
        try {
            const fd = await kernel.vfs.opendir(path);
            const vfs_entries = fd.entries;

            const context_entries: Entry[] = [];
            for(const vfs_entry of vfs_entries) {
                const stat = await kernel.vfs.stat(path + "/" + vfs_entry.name);
                const ext = vfs_entry.name.split(".").slice(1).join(".");

                const entry: Entry = {
                    type: stat.type === 0 ? "file" : "directory",
                    name: vfs_entry.name,

                    icon: await getIconForEntry(path, vfs_entry),

                    ext: ext,
                    size: stat.type === 0 ? stat.size : undefined,

                    created_at: stat.created_at,
                    modified_at: stat.modified_at
                };

                context_entries.push(entry);
            }

            currentPath = path;
            await x11.changeProperty(display, window, "_NET_WM_NAME", "yFileManager - " + path);

            ipc.fetched_directory?.({ entries: context_entries, path: path }, null);
        } catch(error) {
            console.error("Error opening directory:", error);
            ipc.fetched_directory?.(null, "Failed to open directory");
        }
    }

    async function openFile(path: string, props?: any) {
        const ext = path.split(".").slice(1).join(".");
        if(ext === "exe") {
            kernel.execve(path, props);
        } else if(ext === "lnk") {
            const formatUtils = new utils.vfsFormat(kernel.vfs);
            const { targetPath, props: targetProps } = await formatUtils.readShortcut(path);

            await openFile(targetPath, targetProps);
        } else if(ext === "txt") {
            await kernel.execve("/etc/applications/notepad.exe", path);
        }
    }

    async function getIconForEntry(path: string, entry: DirEntry): Promise<string> {
        const formatUtils = new utils.vfsFormat(kernel.vfs);

        if(entry.type === 1) {
            return icon_directory_32;
        }

        const ext = entry.name.split(".").slice(1).join(".");
        if(ext === "txt") {
            return icon_txt_32;
        }

        if(ext === "lnk") {
            try {
                const { icon } = await formatUtils.readShortcut(path + "/" + entry.name);
                return icon ?? icon_executable_32;
            } catch (e) {
                console.error("Error reading shortcut:", e);
            }
        }

        if(ext === "exe") {
            return icon_executable_32;
        }

        return icon_unknown_32;
    }

    let has_context = false;
    let should_close = false;

    homeWatcher();

    /*setTimeout(async () => {
        const dir = await kernel.vfs.opendir("/home/y3v4d/desktop");
        let entry;
        while(entry = kernel.vfs.readdir(dir)) {
            console.log("Desktop entry:", entry);
            if(entry.type === 0) {
                await kernel.vfs.unlink("/home/y3v4d/desktop/" + entry.name);
            } else {
                await kernel.vfs.rmdir("/home/y3v4d/desktop/" + entry.name);
            }
        }

        await kernel.vfs.rmdir("/home/y3v4d/desktop");
        await kernel.vfs.close(inotify_fd);
    }, 1000);*/

    while(!should_close) {
        let event;
        while(event = x11.nextEvent(display)) {
            if(event.type === 99) {
                if(event.client_message_type === "WM_DELETE_WINDOW") {
                    should_close = true;
                }
            } else if(event.type === 4) {
                if(event.window.id === window.id && !has_context) {
                    console.log("Attaching context...");
                    x11.attachContext(window, svelte.createContext(context, {
                        ipc: ipc
                    }));
                }
            }
        }

        await kernel.yield();
    }

    should_close = true;

    await x11.destroyWindow(display, window);
    await x11.closeDisplay(display);
}