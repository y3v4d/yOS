enum YEventType {
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

enum YConfigureRequestMask {
    NONE = 0,
    X = 1 << 0,
    Y = 1 << 1,
    WIDTH = 1 << 2,
    HEIGHT = 1 << 3,
    ABOVE = 1 << 4,
    
}

enum YEventMask {
    NONE = 0,
    SUBSTRUCTURE_REDIRECT = 1 << 1,
    SUBSTRUCTURE_NOTIFY = 1 << 2,
    STRUCTURE_NOTIFY = 1 << 3,
    PROPERTY_CHANGE = 1 << 4
}

interface YEvent {
    type: YEventType;

    windowId: number;

    x?: number;
    y?: number;
    width?: number;
    height?: number;

    property_key?: string;
    property_value?: any;

    client_message_type?: string;

    aboveId?: number;
    value_mask?: number;
}

interface YDisplay {
    id: number;

    pid: number;
    socket: Socket;

    event_queue: YEvent[];
    windows: Set<YWindow>;

    baseResourceId: number;
}

interface YWindow {
    id: number;

    x: number;
    y: number;
    width: number;
    height: number;

    background_color: string;

    parent: YWindow;
    children: YWindow[];

    mapped: boolean;
    props: Record<string, any>;

    override_redirect: boolean;
    dom: HTMLElement;
}

interface Reply {
    type: string;
}

interface ReplyInitial extends Reply {
    rootWindowId: number;

    displayWidth: number;
    displayHeight: number;

    nextResourceId: number;
}

type YWindowSubscribers = Map<YDisplay, number>;

let clients: Map<number, YDisplay> = new Map();
let windows: Map<number, YWindow> = new Map();
let subscribers: Map<number, YWindowSubscribers> = new Map();

let rootWindow: YWindow = null!;
let nonce = 0;

let kernelEvents = null;
let nextResourceId = 1;

const MAX_RESOURCE_POOL = 1000;

const rootDOM = document.body;

export default async function(args: any[]) {
    console.log("Starting y11 app with args:", args);

    rootWindow = {
        id: 0,

        x: 0,
        y: 0,
        width: rootDOM.clientWidth,
        height: rootDOM.clientHeight,

        background_color: "#161616",

        mapped: true,
        props: {},

        parent: null!,
        children: [],

        override_redirect: false,
        dom: rootDOM
    };

    windows.set(rootWindow.id, rootWindow);
    subscribers.set(rootWindow.id, new Map());

    let socket = kernel.socket();

    kernel.bind(socket, `y11.sock`);
    kernel.listen(socket);

    let should_close = false;
    while(!should_close) {
        const connection = await kernel.accept(socket);
        handleNewConnection(connection);
    }
}

function sendMessage(display: YDisplay, msg: any) {
    //console.log(`Y11: Sending message to display socket ${display.socket.id}:`, msg);
    kernel.send(display.socket, new TextEncoder().encode(JSON.stringify(msg)));
}

async function handleNewConnection(socket: Socket) {
    const display: YDisplay = {
        id: nonce++,
        pid: socket.pid,

        socket: socket,
        
        event_queue: [],
        windows: new Set(),

        baseResourceId: nextResourceId
    };

    nextResourceId += MAX_RESOURCE_POOL;

    clients.set(display.id, display);
    console.log(`Y11: New display connection ${socket.id} with id ${display.id} and pid ${display.pid}`);

    sendMessage(display, {
        type: "initial_reply",
        rootWindowId: rootWindow.id,
        displayWidth: rootWindow.width,
        displayHeight: rootWindow.height,
        nextResourceId: display.baseResourceId
    } satisfies ReplyInitial);

    let should_close = false;
    while(!should_close) {
        const res = await kernel.readv(socket);

        if(res === null) {
            console.log(`Y11: Socket ${socket.id} closed by client, closing display ${display.id}`);
            should_close = true;
            break;
        }

        const data = JSON.parse(new TextDecoder().decode(res));
        handleClientMessage(display, data);
    }

    for(const [_, subs] of subscribers) {
        if(subs.has(display)) {
            subs.delete(display);
        }
    }

    for(const window of display.windows) {
        destroyWindow(display, window);
    }

    // Cleanup on disconnect
    clients.delete(display.id);
    console.log(`Y11: Closed display ${display.id} for socket ${socket.id}`);
}

function handleClientMessage(display: YDisplay, msg: any) {
    if(msg.type === "create_window") {
        const parent = windows.get(msg.parentId);
        if(!parent) {
            console.warn(`Y11: Parent window with id ${msg.parentId} not found for display ${display.id}`);
            return;
        }

        createWindow(display, msg.windowId, parent);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Created window for display ${display.id} with parent ${msg.parentId}`);
    } else if(msg.type === "map_window") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        mapWindow(display, window);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Mapped window with id ${msg.windowId} for display ${display.id}`);
    } else if(msg.type === "destroy_window") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        destroyWindow(display, window);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Destroyed window with id ${msg.windowId} for display ${display.id}`);
    } else if(msg.type === "select_input") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        selectInput(display, window, msg.mask);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Display ${display.id} selected input for window id ${msg.windowId} with mask ${msg.mask}`);
    } else if(msg.type === "send_event") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        sendEvent(display, window, msg.event);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Sent event to window id ${msg.windowId} for display ${display.id}`);
    } else if(msg.type === "configure_window") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        configureWindow(display, window, msg.props);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Configured window id ${msg.windowId} for display ${display.id} with props`, msg.props);
    } else if(msg.type === "change_property") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        changeProperty(display, window, msg.property_key, msg.property_value);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Changed property ${msg.property_key} of window id ${msg.windowId} for display ${display.id} to value`, msg.property_value);
    } else if(msg.type === "get_property") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        const value = window.props[msg.property_key];
        sendMessage(display, { type: "get_property_reply", seq: msg.seq, property_key: msg.property_key, property_value: value });
    } else if(msg.type === "unmap_window") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        unmapWindow(display, window);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Unmapped window with id ${msg.windowId} for display ${display.id}`);
    } else if(msg.type === "raise_window") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        raiseWindow(display, window);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Raised window with id ${msg.windowId} for display ${display.id}`);
    } else if(msg.type === "lower_window") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        lowerWindow(display, window);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Lowered window with id ${msg.windowId} for display ${display.id}`);
    } else if(msg.type === "restack_windows") {
        const wins = msg.windowIds.map((id: number) => {
            const window = windows.get(id);
            if(!window) {
                console.warn(`Y11: Window with id ${id} not found for display ${display.id}`);
                return null;
            }

            return window;
        });

        if(wins.includes(null)) {
            return;
        }

        restackWindows(display, wins as YWindow[]);
        sendMessage(display, { type: "ack", seq: msg.seq });
    } else if(msg.type === "reparent_window") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        const newParent = windows.get(msg.newParentId);
        if(!newParent) {
            console.warn(`Y11: New parent window with id ${msg.newParentId} not found for display ${display.id}`);
            return;
        }

        reparentWindow(display, window, newParent, msg.x, msg.y);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Reparented window with id ${msg.windowId} to new parent id ${msg.newParentId} for display ${display.id}`);
    } else if(msg.type === "query_tree") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        const parentId = window.parent ? window.parent.id : null;
        const childrenIds = window.children.map(c => c.id);
        sendMessage(display, { type: "query_tree_reply", seq: msg.seq, rootId: rootWindow.id, parentId, childrenIds });
    } else if(msg.type === "change_window_background_color") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        window.background_color = msg.color;
        syncDOM(window);
        sendMessage(display, { type: "ack", seq: msg.seq });

        //console.log(`Y11: Changed background color of window with id ${msg.windowId} to ${msg.color} for display ${display.id}`);
    } else if(msg.type === "get_window_geometry") {
        const window = windows.get(msg.windowId);
        if(!window) {
            console.warn(`Y11: Window with id ${msg.windowId} not found for display ${display.id}`);
            return;
        }

        sendMessage(display, { type: "get_window_geometry_reply", seq: msg.seq, x: window.x, y: window.y, width: window.width, height: window.height });
    } else {
        console.warn(`Y11: Unknown message type ${msg.type} from display ${display.id}`);
    }
}

function createWindow(display: YDisplay, windowId: number, parent: YWindow) {
    if(windowId < display.baseResourceId || windowId >= display.baseResourceId + MAX_RESOURCE_POOL) {
        console.warn(`Y11: Invalid window id ${windowId} for display ${display.id}. Must be between ${display.baseResourceId} and ${display.baseResourceId + MAX_RESOURCE_POOL - 1}`);
        return;
    }

    if(windows.has(windowId)) {
        console.warn(`Y11: Window id ${windowId} already exists. Cannot create window for display ${display.id}`);
        return;
    }

    const dom = document.createElement("div");
    dom.id = `window-${windowId}`;
    dom.style.position = "absolute";
    dom.style.overflow = "hidden";
    dom.style.pointerEvents = "auto";
    dom.style.backgroundColor = "#F0F0F0";
    dom.style.display = "none";

    const window: YWindow = {
        id: windowId,

        x: 0,
        y: 0,
        width: 400,
        height: 300,

        background_color: "#F0F0F0",

        mapped: false,
        props: {},

        parent: parent,
        children: [],
        override_redirect: false,
        dom: dom
    };

    parent.dom.appendChild(dom);

    parent.children.push(window);
    syncDOM(window);
    syncChildrenOrderDOM(parent);

    display.windows.add(window);
    windows.set(window.id, window);
    subscribers.set(window.id, new Map([[display, YEventMask.NONE]]));

    maybeSendEvents(parent, {
        type: YEventType.CREATE_NOTIFY,
        windowId: window.id
    });
}

function destroyWindow(display: YDisplay, window: YWindow) {
    for(const child of window.children) {
        destroyWindow(display, child);
    }

    if(window.parent) {
        window.parent.children = window.parent.children.filter(c => c.id !== window.id);
        syncChildrenOrderDOM(window.parent);
    }

    if(window.parent) {
        window.parent.dom.removeChild(window.dom);
    }

    display.windows.delete(window);
    windows.delete(window.id);

    const event = {
        type: YEventType.DESTROY_NOTIFY,
        windowId: window.id
    }

    if(checkEventMask(window.parent, YEventMask.SUBSTRUCTURE_NOTIFY)) {
        maybeSendEvents(window.parent, event);
    }

    if(checkEventMask(window, YEventMask.STRUCTURE_NOTIFY)) {
        maybeSendEvents(window, event);
    }
    
    subscribers.delete(window.id);
}

function configureWindow(display: YDisplay, window: YWindow, props: Partial<{ x: number; y: number; width: number; height: number; }>) {
    const value_mask = 
        (props.x !== undefined ? YConfigureRequestMask.X : 0) |
        (props.y !== undefined ? YConfigureRequestMask.Y : 0) |
        (props.width !== undefined ? YConfigureRequestMask.WIDTH : 0) |
        (props.height !== undefined ? YConfigureRequestMask.HEIGHT : 0);

    if(!window.override_redirect && checkEventMask(window.parent, YEventMask.SUBSTRUCTURE_REDIRECT)) {
        if(maybeSendEvents(window.parent, {
            type: YEventType.CONFIGURE_REQUEST,
            windowId: window.id,
            x: props.x,
            y: props.y,
            width: props.width,
            height: props.height,
            value_mask: value_mask
        }, display)) {
            console.log(`Y11: Map request for window id ${window.id} redirected by parent window id ${window.parent.id}`);
            return;
        }
    }

    window.x = props.x ?? window.x;
    window.y = props.y ?? window.y;
    window.width = props.width ?? window.width;
    window.height = props.height ?? window.height;

    syncDOM(window);

    const event = {
        type: YEventType.CONFIGURE_NOTIFY,
        windowId: window.id,
        x: props.x,
        y: props.y,
        width: props.width,
        height: props.height,
        value_mask: value_mask
    };

    if(checkEventMask(window.parent, YEventMask.SUBSTRUCTURE_NOTIFY)) {
        maybeSendEvents(window.parent, event);
    }

    if(checkEventMask(window, YEventMask.STRUCTURE_NOTIFY)) {
        maybeSendEvents(window, event);
    }
}

function changeProperty(display: YDisplay, window: YWindow, prop: string, value: any) {
    window.props[prop] = value;

    const event = {
        type: YEventType.PROPERTY_NOTIFY,
        windowId: window.id,
        property_key: prop,
        property_value: value
    };

    maybeSendEvents(window, event);
}

function sendEvent(display: YDisplay, window: YWindow, event: YEvent) {
    maybeSendEvents(window, event);
}

function selectInput(display: YDisplay, window: YWindow, mask: number) {
    let subs = subscribers.get(window.id);
    if(!subs) {
        subs = new Map();
        subscribers.set(window.id, subs);
    }

    subs.set(display, mask);
}

function mapWindow(display: YDisplay, window: YWindow) {
    if(window.mapped) {
        console.warn(`Y11: Window id ${window.id} is already mapped for display ${display.id}`);
        return;
    }

    if(!window.override_redirect && checkEventMask(window.parent, YEventMask.SUBSTRUCTURE_REDIRECT)) {
        if(maybeSendEvents(window.parent, {
            type: YEventType.MAP_REQUEST,
            windowId: window.id,
        }, display)) {
            console.log(`Y11: Map request for window id ${window.id} redirected by parent window id ${window.parent.id}`);
            return;
        }
    }

    window.dom.style.display = "block";
    window.mapped = true;
    
    console.log(`X11: Mapped window id ${window.id} for display id ${display.id}`);

    const event = {
        type: YEventType.MAP_NOTIFY,
        windowId: window.id
    };

    if(checkEventMask(window.parent, YEventMask.SUBSTRUCTURE_NOTIFY)) {
        maybeSendEvents(window.parent, event);
    }

    if(checkEventMask(window, YEventMask.STRUCTURE_NOTIFY)) {
        maybeSendEvents(window, event);
    }      
}

function unmapWindow(display: YDisplay, window: YWindow) {
    if(!window.mapped) {
        return;
    }

    window.dom.style.display = "none";
    window.mapped = false;

    console.log(`Y11: Unmapping window id ${window.id} for display id ${display.id}`);

    const event = {
        type: YEventType.UNMAP_NOTIFY,
        windowId: window.id
    };

    if(checkEventMask(window.parent, YEventMask.SUBSTRUCTURE_NOTIFY)) {
        maybeSendEvents(window.parent, event);
    }

    if(checkEventMask(window, YEventMask.STRUCTURE_NOTIFY)) {
        maybeSendEvents(window, event);
    }        
}

function raiseWindow(display: YDisplay, window: YWindow) {
    if(!window.parent) {
        throw new Error(`Y11: Cannot raise window id ${window.id} without a parent`);
    }

    const parent = window.parent;
    if(!window.override_redirect && checkEventMask(parent, YEventMask.SUBSTRUCTURE_REDIRECT)) {
        if(maybeSendEvents(parent, {
            type: YEventType.CONFIGURE_REQUEST,
            windowId: window.id,
            aboveId: parent.children[parent.children.length - 1].id,
            value_mask: YConfigureRequestMask.ABOVE
        }, display)) {
            console.log(`Y11: Raise request for window id ${window.id} redirected by parent window id ${parent.id}`);
            return;
        }
    }

    console.log(`Y11: Raising window id ${window.id} in parent window id ${parent.id}`);

    const index = parent.children.findIndex(c => c.id === window.id);
    if(index === -1) {
        throw new Error(`Y11: Window id ${window.id} not found in parent window id ${parent.id} children`);
    }

    parent.children.splice(index, 1);
    parent.children.push(window);

    syncChildrenOrderDOM(parent);

    const event = {
        type: YEventType.CONFIGURE_NOTIFY,
        windowId: window.id,
        aboveId: parent.children[parent.children.length - 2]?.id ?? -1,
        value_mask: YConfigureRequestMask.ABOVE
    };

    if(checkEventMask(parent, YEventMask.SUBSTRUCTURE_NOTIFY)) {
        maybeSendEvents(parent, event);
    }

    if(checkEventMask(window, YEventMask.STRUCTURE_NOTIFY)) {
        maybeSendEvents(window, event);
    }
}

function lowerWindow(display: YDisplay, window: YWindow) {
    if(!window.parent) {
        throw new Error(`Y11: Cannot lower window id ${window.id} without a parent`);
    }

    if(!window.override_redirect && checkEventMask(window.parent, YEventMask.SUBSTRUCTURE_REDIRECT)) {
        if(maybeSendEvents(window.parent, {
            type: YEventType.CONFIGURE_REQUEST,
            windowId: window.id,
            aboveId: -1,
            value_mask: YConfigureRequestMask.ABOVE
        }, display)) {
            console.log(`Y11: Lower request for window id ${window.id} redirected by parent window id ${window.parent.id}`);
            return;
        }
    }

    const parent = window.parent;
    const index = parent.children.findIndex(c => c.id === window.id);
    if(index === -1) {
        throw new Error(`X11: Window id ${window.id} not found in parent window id ${parent.id} children`);
    }

    parent.children.splice(index, 1);
    parent.children.unshift(window);

    syncChildrenOrderDOM(parent);

    const event = {
        type: YEventType.CONFIGURE_NOTIFY,
        windowId: window.id,
        aboveId: -1,
        value_mask: YConfigureRequestMask.ABOVE
    };

    if(checkEventMask(parent, YEventMask.SUBSTRUCTURE_NOTIFY)) {
        maybeSendEvents(parent, event);
    }

    if(checkEventMask(window, YEventMask.STRUCTURE_NOTIFY)) {
        maybeSendEvents(window, event);
    }
}

function restackWindows(display: YDisplay, windows: YWindow[]) {
    if(windows.length === 0) {
        return;
    }

    const parent = windows[0].parent;
    if(!parent) {
        throw new Error(`Y11: Cannot restack windows without a parent`);
    }

    for(const window of windows) {
        if(window.parent?.id !== parent.id) {
            throw new Error(`Y11: Cannot restack windows from different parents (window id ${window.id} has parent id ${window.parent?.id}, expected parent id ${parent.id})`);
        }
    }

    let sent_substructure_redirect = false;
    const hasSubstructureRedirect = checkEventMask(parent, YEventMask.SUBSTRUCTURE_REDIRECT);

    const children = [...parent.children];
    for(let i = 1; i < windows.length; i++) {
        const window = windows[i];
        if(hasSubstructureRedirect && !window.override_redirect) {
            if(maybeSendEvents(parent, {
                type: YEventType.CONFIGURE_REQUEST,
                windowId: window.id,
                aboveId: windows[i - 1].id,
                value_mask: YConfigureRequestMask.ABOVE
            }, display)) {
                console.log(`X11: Restack request for window id ${window.id} redirected by parent window id ${parent.id}`);
                sent_substructure_redirect = true;
                continue;
            }
        }

        const index = children.findIndex(c => c.id === window.id);
        children.splice(index, 1);
    }

    if(sent_substructure_redirect) {
        console.log(`Y11: Restack request for windows redirected by parent window id ${parent.id}`);
        return;
    }

    const firstIndex = children.findIndex(c => c.id === windows[0].id);
    if(firstIndex === -1) {
        throw new Error(`X11: Window id ${windows[0].id} not found in parent window id ${parent.id} children`);
    }

    for(let i = 1; i < windows.length; i++) {
        children.splice(firstIndex, 0, windows[i]);
    }

    parent.children = children;
    syncChildrenOrderDOM(parent);
}

function reparentWindow(display: YDisplay, window: YWindow, newParent: YWindow, x: number, y: number) {
    if(window.parent) {
        window.parent.children = window.parent.children.filter(c => c.id !== window.id);
        window.parent.dom.removeChild(window.dom);
    }

    newParent.children.push(window);
    window.parent = newParent;

    newParent.dom.appendChild(window.dom);

    window.x = x;
    window.y = y;

    syncDOM(window);
    syncChildrenOrderDOM(newParent);
    syncChildrenOrderDOM(window.parent);
}

function syncDOM(window: YWindow) {
    window.dom.style.left = `${window.x}px`;
    window.dom.style.top = `${window.y}px`;
    window.dom.style.width = `${window.width}px`;
    window.dom.style.height = `${window.height}px`;
    window.dom.style.backgroundColor = window.background_color;
}

function syncChildrenOrderDOM(window: YWindow) {
    for(let i = 0; i < window.children.length; i++) {
        const child = window.children[i];
        child.dom.style.zIndex = `${i}`;
    }
}

function maybeSendEvents(window: YWindow, event: YEvent, exclude?: YDisplay) {
    const subs = subscribers.get(window.id);
    if(!subs) {
        return false;
    }

    let send = false;
    for(const [display, mask] of subs) {
        if(exclude && display.id === exclude.id) {
            continue;
        }

        if(doesEventMatchMask(event, mask)) {
            sendMessage(display, event);
            send = true;
        }
    }

    return send;
}

function doesEventMatchMask(event: YEvent, mask: number) {
    if(event.type === YEventType.CLIENT_MESSAGE) {
        return true;
    }

    if(event.type === YEventType.CONFIGURE_REQUEST || event.type === YEventType.MAP_REQUEST) {
        return (mask & YEventMask.SUBSTRUCTURE_REDIRECT) === YEventMask.SUBSTRUCTURE_REDIRECT;
    }

    if((mask & YEventMask.SUBSTRUCTURE_NOTIFY) === YEventMask.SUBSTRUCTURE_NOTIFY && 
        (event.type === YEventType.CONFIGURE_NOTIFY || event.type === YEventType.MAP_NOTIFY ||
        event.type === YEventType.UNMAP_NOTIFY || event.type === YEventType.CREATE_NOTIFY ||
        event.type === YEventType.DESTROY_NOTIFY)) {
        return true;
    }

    if((mask & YEventMask.STRUCTURE_NOTIFY) === YEventMask.STRUCTURE_NOTIFY && 
        (event.type === YEventType.CONFIGURE_NOTIFY || event.type === YEventType.DESTROY_NOTIFY ||
        event.type === YEventType.MAP_NOTIFY || event.type === YEventType.UNMAP_NOTIFY)) {
        return true;
    }

    if(event.type === YEventType.PROPERTY_NOTIFY) {
        return (mask & YEventMask.PROPERTY_CHANGE) === YEventMask.PROPERTY_CHANGE;
    }

    return false;
}

function checkEventMask(window: YWindow, mask: number) {
    const subs = subscribers.get(window.id);
    if(!subs) {
        return false;
    }

    for(const [display, subMask] of subs) {
        if((subMask & mask) === mask) {
            return true;
        }
    }

    return false;
}