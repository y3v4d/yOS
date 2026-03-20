import context from "./context.svelte";
import icon_notepad_16 from "./assets/icon_notepad_16.png";

const x11 = include("y11");
const svelte = include("svelte");
const utils = include("utils");

export default async function(args) {
    console.log("Starting notepad app with args:", args);
    console.log("Notepad PID is:", kernel.getpid());

    const filename = args.length > 0 ? args[0] : null;
    let content = "";

    const openFile = async (filename) => {
        const fd = await kernel.vfs.open(filename);
        if(!fd) {
            content = "";
            filename = "";
            fd = null;

            throw new Error("Failed to open file");
        }

        await kernel.vfs.fseek(fd, 0, "END");
        const size = fd.position;
        await kernel.vfs.fseek(fd, 0, "SET");

        const fileData = await kernel.vfs.read(fd, size);

        try {
            const binaryReader = new utils.binaryReader(fileData);

            const length = binaryReader.uint32();
            const data = binaryReader.string(length);

            content = data;
            ipc.on_src_content_change?.(content);
        } catch(error) {
            content = "";
        }
        
        filename = filename;
        await x11.changeProperty(display, window, "_NET_WM_NAME", `yNotepad - ${filename}`);
    }

    const display = await x11.openDisplay();
    const window = await x11.createWindow(display, x11.getRootWindow(display));

    const ipc = {
        on_context_mount: () => {
            if(content) {
                ipc.on_src_content_change?.(content);
            }

            ipc.on_window_size_change?.(640, 480);
        },

        on_ctx_content_change: async (newContent) => {
            content = newContent;
            debouncedSave(); 
        },

        on_window_resize: (width, height) => {
            const newWidth = Math.max(200, width);
            const newHeight = Math.max(100, height);

            x11.configureWindow(display, window, {
                width: newWidth,
                height: newHeight
            });

            ipc.on_window_size_change?.(newWidth, newHeight);
        }
    };

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func(...args);
            }, delay);
        };
    };

    const debouncedSave = debounce(async () => {
        const fd = await kernel.vfs.open(filename);
        console.log("Opened file descriptor for writing:", fd);

        const binaryWriter = new utils.binaryWriter(4 + content.length * 2);
        binaryWriter.uint32(content.length);
        binaryWriter.string(content);

        await kernel.vfs.write(fd, binaryWriter.getBuffer());
    }, 1000);

    await x11.selectInput(display, window, 8); // STRUCTURE_NOTIFY

    await x11.changeProperty(display, window, "_NET_WM_NAME", "External Notepad");
    await x11.changeProperty(display, window, "_NET_WM_ICON", icon_notepad_16);
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");

    await x11.configureWindow(display, window, {
        width: 640,
        height: 480,
        x: 100,
        y: 100
    });

    await x11.mapWindow(display, window);
    await x11.raiseWindow(display, window);

    if(filename) {
        try {
            await openFile(filename);
        } catch(error) {
            console.error("Error opening file:", error);
        }
    }

    let has_context = false;
    let should_close = false;
    while(!should_close) {
        let event;
        while(event = x11.nextEvent(display)) {
            console.log("Received event:", event);
            if(event.type === 99) {
                if(event.client_message_type == "WM_DELETE_WINDOW") {
                    should_close = true;
                    console.log("Received close event, exiting...");
                }
            } else if(event.type === 4) {
                if(event.window.id === window.id && !has_context) {
                    x11.attachContext(window, svelte.createContext(context, {
                        ipc: ipc,
                    }));
                    has_context = true;
                }
            }
        }

        await kernel.yield();
    }

    await x11.destroyWindow(display, window);
    await x11.closeDisplay(display);
}