import { createSvelteContext } from "../yos/context/svelte-context";
import { Executable, Kernel } from "../yos/core/kernel";
import type { FileDescriptor } from "../yos/core/vfs";
import { XEventType, type X11, type XDisplay, type XWindow } from "../yos/core/x11";
import { BinaryReader } from "../yos/utils/binary-reader";
import { BinaryWriter } from "../yos/utils/binary-writer";
import type { NotepadIPC } from "./app-ynotepad.svelte";
import AppYnotepad from "./app-ynotepad.svelte";

import icon_notepad_16 from "../assets/icons/icon_notepad_16.png";

class yNotepad extends Executable {
    readonly x11: X11;

    private _display: XDisplay | null = null;
    private _window: XWindow | null = null;

    private _fd: FileDescriptor | null = null;
    private _filename: string = "";
    private _content: string = "";

    private _ipc: NotepadIPC = {
        on_context_mount: () => {
            if(this._filename) {
                this._ipc.open_file?.(this._filename);
            }

            if(this._content) {
                this._ipc.on_src_content_change?.(this._content);
            }

            this._ipc.on_window_size_change?.(640, 480);
        },

        on_ctx_content_change: (newContent) => {
            this._content = newContent;

            if(this._fd) {
                const binaryWriter = new BinaryWriter(4 + newContent.length * 2);
                binaryWriter.uint32(newContent.length);
                binaryWriter.string(newContent);

                this.kernel.vfs.write(this._fd, binaryWriter.getBuffer());
            }
        },

        on_window_resize: (width, height) => {
            if(!this._display) return;
            if(!this._window) return;

            const newWidth = Math.max(200, width);
            const newHeight = Math.max(100, height);

            this.x11.configureWindow(this._display, this._window, {
                width: newWidth,
                height: newHeight
            });

            this._ipc.on_window_size_change?.(newWidth, newHeight);
        }
    }

    constructor(
        readonly kernel: Kernel,
        readonly props: {
            filename?: string;
        }
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

        this.x11.changeProperty(this._display, this._window, "_NET_WM_NAME", "yNotepad");
        this.x11.changeProperty(this._display, this._window, "_NET_WM_ICON", icon_notepad_16);
        this.x11.changeProperty(this._display, this._window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");

        this.x11.setWindowBackgroundColor(this._display, this._window, "#FFFFFF");

        this.x11.attachContext(this._display, this._window, createSvelteContext(AppYnotepad, {
            ipc: this._ipc
        }));

        this.x11.mapWindow(this._display, this._window);
        this.x11.raiseWindow(this._display, this._window);
        this.x11.configureWindow(this._display, this._window, {
            width: 640,
            height: 480,
            x: 100,
            y: 100
        });

        if(this.props.filename) {
            try {
                this._openFile(this.props.filename);
            } catch(err) {
                console.error("yNotepad: Failed to open initial file:", err);
            }
        }
    }

    onTick() {
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

    onDestroy() {
        if(!this._display) return;

        if(this._window) {
            this.x11.destroyWindow(this._display, this._window);
            this._window = null;
        }
        
        this.x11.closeDisplay(this._display);
        this._display = null;
    }

    private _openFile(filename: string) {
        const fd = this.kernel.vfs.open(filename);
        if(!fd) {
            this._content = "";
            this._filename = "";
            this._fd = null;

            throw new Error("Failed to open file");
        }

        this.kernel.vfs.fseek(fd, 0, "END");
        const size = fd.position;
        this.kernel.vfs.fseek(fd, 0, "SET");

        const fileData = this.kernel.vfs.read(fd, size);

        try {
            const binaryReader = new BinaryReader(fileData);

            const length = binaryReader.uint32();
            const data = binaryReader.string(length);

            this._content = data;
        } catch(error) {
            this._content = "";
        }
        

        this._fd = fd;
        this._filename = filename;

        this.x11.changeProperty(this._display!, this._window!, "_NET_WM_NAME", `yNotepad - ${filename}`);
    }
}

export { yNotepad };