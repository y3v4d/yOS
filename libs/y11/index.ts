export enum XEventType {
    NONE = 0,
    CONFIGURE_REQUEST = 1,
    CONFIGURE_NOTIFY = 2,
    MAP_REQUEST = 3,
    MAP_NOTIFY = 4,
    UNMAP_NOTIFY = 5,
    PROPERTY_NOTIFY = 6,
    CREATE_NOTIFY = 7,
    DESTROY_NOTIFY = 8,
    CLIENT_MESSAGE = 99
}

export enum XConfigureRequestMask {
    NONE = 0,
    X = 1 << 0,
    Y = 1 << 1,
    WIDTH = 1 << 2,
    HEIGHT = 1 << 3,
    ABOVE = 1 << 4,
    
}

export enum XEventMask {
    NONE = 0,
    SUBSTRUCTURE_REDIRECT = 1 << 1,
    SUBSTRUCTURE_NOTIFY = 1 << 2,
    STRUCTURE_NOTIFY = 1 << 3,
    PROPERTY_CHANGE = 1 << 4
}

export interface XEvent {
    type: XEventType;

    display: _Display;
    window: { id: number };

    x?: number;
    y?: number;
    width?: number;
    height?: number;

    property_key?: string;
    property_value?: any;

    client_message_type?: string;

    above?: { id: number } | null;
    value_mask?: number;
}

type _Display = {
    socket: Socket;
    rootWindow: _Window;

    event_queue: XEvent[];
    pendingReplies: Map<number, (msg: any) => void>;
    nextSeq: number;
    
    pump_close: () => void;

    nextResourceId: number;
}

type _Window = {
    id: number;

    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

const _contextUnmounts = new Map<number, () => void>();
const _displays = new Map<number, _Display>();

export async function openDisplay() {
    const pid = kernel.getpid();
    if(pid === null) {
        throw new Error("Y11: Cannot open display outside of a process context");
    }

    const socket = kernel.socket();
    kernel.connect(socket, "y11.sock");

    const res = await kernel.readv(socket);
    // @ts-ignore
    const data = JSON.parse(new TextDecoder().decode(res));

    console.log(`Y11: Received initial data from display socket ${socket.id}:`, data);
    console.log(`Y11: Opened display with socket id ${socket.id} for process id ${pid}`);

    const rootWindow = {
        id: data.rootWindowId,
        x: 0,
        y: 0,
        width: data.displayWidth,
        height: data.displayHeight,
    } satisfies _Window;

    const display = {
        rootWindow: rootWindow,

        socket: socket,

        pump_close: null!,

        event_queue: [],
        pendingReplies: new Map(),
        nextSeq: 1,

        nextResourceId: data.nextResourceId
    } as _Display;

    _displays.set(display.socket.id, display);

    const closePump = _generateDisplayPump(display);
    display.pump_close = closePump;

    return display;
}

export function closeDisplay(display: _Display) {
    display.pump_close();

    _displays.delete(display.socket.id);
    kernel.close(display.socket);
}

export function getDisplayWidth(display: _Display) {
    return display.rootWindow.width!;
}

export function getDisplayHeight(display: _Display) {
    return display.rootWindow.height!;
}

export async function createWindow(display: _Display, parent: _Window) {
    const windowId = display.nextResourceId++;
    const seq = display.nextSeq++;

    console.log(`Y11: Creating window with id ${windowId} for display socket id ${display.socket.id} with parent window id ${parent.id}`);

    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "create_window",
        seq: seq,
        windowId: windowId,
        parentId: parent.id
    })));

    await _waitForResponse(display, seq);

    return { id: windowId } satisfies _Window;
}

export async function destroyWindow(display: _Display, window: _Window) {
    if(hasContext(window)) {
        destroyContext(window);
    }

    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "destroy_window",
        seq: seq,
        windowId: window.id
    })));

    await _waitForResponse(display, seq);

    console.log(`Y11: Destroyed window with id ${window.id} for display socket id ${display.socket.id}`);
}

export async function changeProperty(display: _Display, window: _Window, prop: string, value: any) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "change_property",
        seq: seq,
        windowId: window.id,
        property_key: prop,
        property_value: value
    })));

    await _waitForResponse(display, seq);
}

export async function getProperty(display: _Display, window: _Window, prop: string) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "get_property",
        seq: seq,
        windowId: window.id,
        property_key: prop
    })));

    const res = await _waitForResponse(display, seq);
    return res.property_value;
}

export async function getGeometry(display: _Display, window: _Window) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "get_window_geometry",
        seq: seq,
        windowId: window.id
    })));

    const res = await _waitForResponse(display, seq);
    return {
        x: res.x,
        y: res.y,
        width: res.width,
        height: res.height
    };
}

export async function configureWindow(display: _Display, window: _Window, props: Partial<{ x: number; y: number; width: number; height: number; }>) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "configure_window",
        seq: seq,
        windowId: window.id,
        props: props
    })));

    await _waitForResponse(display, seq);
}

export async function changeWindowBackgroundColor(display: _Display, window: _Window, color: string) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "change_window_background_color",
        seq: seq,
        windowId: window.id,
        color: color
    })));

    await _waitForResponse(display, seq);
}

export async function selectInput(display: _Display, window: _Window, mask: number) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "select_input",
        seq: seq,
        windowId: window.id,
        mask: mask
    })));

    await _waitForResponse(display, seq);
}

export async function mapWindow(display: _Display, window: _Window) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "map_window",
        seq: seq,
        windowId: window.id
    })));

    await _waitForResponse(display, seq);
}

export async function unmapWindow(display: _Display, window: _Window) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "unmap_window",
        seq: seq,
        windowId: window.id
    })));

    await _waitForResponse(display, seq);
}

export async function raiseWindow(display: _Display, window: _Window) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "raise_window",
        seq: seq,
        windowId: window.id
    })));

    await _waitForResponse(display, seq);
}

export async function lowerWindow(display: _Display, window: _Window) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "lower_window",
        seq: seq,
        windowId: window.id
    })));

    await _waitForResponse(display, seq);
}

export async function restackWindows(display: _Display, windows: _Window[]) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "restack_windows",
        seq: seq,
        windowIds: windows.map(w => w.id)
    })));

    await _waitForResponse(display, seq);
}

export async function reparentWindow(display: _Display, window: _Window, newParent: _Window, x: number, y: number) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "reparent_window",
        seq: seq,
        windowId: window.id,
        newParentId: newParent.id,
        x: x,
        y: y
    })));

    await _waitForResponse(display, seq);
}

export async function queryTree(display: _Display, window: _Window) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "query_tree",
        seq: seq,
        windowId: window.id
    })));

    const res = await _waitForResponse(display, seq);
    return {
        root: getRootWindow(display),
        parent: res.parentId === null ? null : { id: res.parentId } satisfies _Window,
        children: res.childrenIds.map((id: number) => ({ id } satisfies _Window))
    };
}

export async function sendEvent(display: _Display, window: _Window, event: XEvent) {
    const seq = display.nextSeq++;
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify({
        type: "send_event",
        seq: seq,
        windowId: window.id,
        event: event
    })));

    await _waitForResponse(display, seq);
}

export function nextEvent(display: _Display) {
    return display.event_queue.shift() || null;
}

export function attachContext(window: _Window, context: (root: HTMLElement) => () => void) {
    const id = `window-${window.id}`;
    const root = document.getElementById(id);
    if(!root) {
        throw new Error(`Y11: Cannot attach context to window id ${window.id} because DOM element with id ${id} does not exist`);
    }

    const unmount = context(root);
    _contextUnmounts.set(window.id, unmount);
}

export function hasContext(window: _Window) {
    return _contextUnmounts.has(window.id);
}

export function destroyContext(window: _Window) {
    const unmount = _contextUnmounts.get(window.id);
    if(!unmount) {
        throw new Error(`Y11: Cannot destroy context for window id ${window.id} because no context is attached`);
    }

    unmount();
    _contextUnmounts.delete(window.id);
}

export function getRootWindow(display: _Display) {
    return display.rootWindow;
}

function _generateDisplayPump(display: _Display) {
    let should_close_pump = false;
    const pump = async () => {
        while (!should_close_pump) {
            const raw = await kernel.readv(display.socket);
            if (raw === null) break;

            const msg = JSON.parse(new TextDecoder().decode(raw));
            if (msg.seq !== undefined && display.pendingReplies.has(msg.seq)) {
                const resolve = display.pendingReplies.get(msg.seq)!;
                display.pendingReplies.delete(msg.seq);
                
                resolve(msg);
            } else {
                if(msg.windowId) {
                    msg.window = { id: msg.windowId } satisfies _Window;
                    delete msg.windowId;
                }

                if(msg.aboveId == -1) {
                    msg.above = null;
                    delete msg.aboveId;
                } else if(msg.aboveId != undefined) {
                    msg.above = { id: msg.aboveId } satisfies _Window;
                    delete msg.aboveId;
                }

                display.event_queue.push(msg);
            }
        }
    }

    pump();
    return () => {
        should_close_pump = true;
    };
}

function _waitForResponse(display: _Display, seq: number) {
    return new Promise<any>(resolve => {
        display.pendingReplies.set(seq, resolve);
    });
}