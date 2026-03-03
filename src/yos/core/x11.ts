import { Library, type Kernel } from "./kernel";

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

export class XDisplay {
    event_queue: XEvent[] = [];

    constructor(
        readonly id: number,
        readonly server: X11
    ) {}
}

export interface XWindow {
    id: number;

    x: number;
    y: number;
    width: number;
    height: number;

    background_color: string;

    parent: XWindow;
    children: XWindow[];

    mapped: boolean;
    props: Record<string, any>;

    override_redirect: boolean;
    dom: HTMLElement;
}

export interface XEvent {
    type: XEventType;

    display: XDisplay;
    window: XWindow;

    x?: number;
    y?: number;
    width?: number;
    height?: number;

    property_key?: string;
    property_value?: any;

    client_message_type?: string;

    above?: XWindow;
    value_mask?: number;
}

type XWindowSubscribers = Map<XDisplay, number>;
type WindowContext = (root: HTMLElement) => () => void;
type WindowContextUnmount = () => void;

export class X11 extends Library {
    private _clients: Map<number, XDisplay> = new Map();
    private _windows: Map<number, XWindow> = new Map();
    private _contexts: Map<number, WindowContext> = new Map();
    private _contextUnmounts: Map<number, WindowContextUnmount> = new Map();
    private _windowOwners: Map<number, XDisplay> = new Map();
    private _subscribers: Map<number, XWindowSubscribers> = new Map();

    private _rootWindow: XWindow;

    private _windowNonce: number = 0;
    private _nonce: number = 0;

    constructor(
        readonly kernel: Kernel, 
        readonly rootDOM: HTMLElement
    ) {
        super(kernel);
        
        this._rootWindow = {
            id: this._windowNonce++,
            
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

        this._windows.set(this._rootWindow.id, this._rootWindow);
        this._subscribers.set(this._rootWindow.id, new Map());
    }

    getName() {
        return "x11";
    }

    openDisplay() {
        const display = new XDisplay(this._nonce++, this);
        this._clients.set(display.id, display);

        return display;
    }

    closeDisplay(display: XDisplay) {
        for(const [windowId, subscribers] of this._subscribers.entries()) {
            if(subscribers.has(display)) {
                subscribers.delete(display);
            }
        }

        this._clients.delete(display.id);
    }
    
    createWindow(display: XDisplay, parent: XWindow) {
        const id = this._windowNonce++;

        const dom = document.createElement("div");
        dom.id = `window-${id}`;
        dom.style.position = "absolute";
        dom.style.overflow = "hidden";
        dom.style.pointerEvents = "auto";
        dom.style.backgroundColor = "#F0F0F0";
        dom.style.display = "none";

        const window: XWindow = {
            id: id,

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
        this._syncDOM(window);
        this._syncChildrenOrderDOM(parent);

        this._windows.set(window.id, window);
        this._windowOwners.set(window.id, display);
        this._subscribers.set(window.id, new Map([[display, XEventMask.NONE]]));

        this._maybeSendEvents(parent, {
            type: XEventType.CREATE_NOTIFY,
            display,
            window
        });

        return window;
    }

    attachContext(display: XDisplay, window: XWindow, context: (root: HTMLElement) => () => void) {
        if(this._contexts.has(window.id)) {
            throw new Error(`X11: Window id ${window.id} already has a context attached`);
        }

        //const unmount = context(window.dom);

        this._contexts.set(window.id, context);
        //this._contextUnmounts.set(window.id, unmount);

        console.log(`X11: Attached context for window id ${window.id}`);
    }

    destroyContext(display: XDisplay, window: XWindow) {
        const unmount = this._contextUnmounts.get(window.id);
        if(!unmount) {
            throw new Error(`X11: Window id ${window.id} has no context to destroy`);
        }

        unmount();

        this._contexts.delete(window.id);
        this._contextUnmounts.delete(window.id);
    }

    destroyWindow(display: XDisplay, window: XWindow) {
        for(const child of window.children) {
            this.destroyWindow(display, child);
        }

        if(this._contextUnmounts.has(window.id)) {
            this.destroyContext(display, window);
        }

        if(window.parent) {
            window.parent.children = window.parent.children.filter(c => c.id !== window.id);
            this._syncChildrenOrderDOM(window.parent);
        }

        if(window.parent) {
            //console.log(`X11: Unmapping window id ${window.id} for display id ${display.id}`);
            window.parent.dom.removeChild(window.dom);
        }

        this._windows.delete(window.id);
        this._windowOwners.delete(window.id);

        const event = {
            type: XEventType.DESTROY_NOTIFY,
            display,
            window
        }

        if(this._checkEventMask(window.parent, XEventMask.SUBSTRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window.parent, event);
        }

        if(this._checkEventMask(window, XEventMask.STRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window, event);
        }
        
        this._subscribers.delete(window.id);
    }

    configureWindow(display: XDisplay, window: XWindow, props: Partial<{ x: number; y: number; width: number; height: number; }>) {
        const value_mask = (props.x !== undefined ? XConfigureRequestMask.X : 0) |
                           (props.y !== undefined ? XConfigureRequestMask.Y : 0) |
                           (props.width !== undefined ? XConfigureRequestMask.WIDTH : 0) |
                           (props.height !== undefined ? XConfigureRequestMask.HEIGHT : 0);

        if(!window.override_redirect && this._checkEventMask(window.parent, XEventMask.SUBSTRUCTURE_REDIRECT)) {
            if(this._maybeSendEvents(window.parent, {
                type: XEventType.CONFIGURE_REQUEST,
                display,
                window,
                x: props.x,
                y: props.y,
                width: props.width,
                height: props.height,
                value_mask: value_mask
            }, display)) {
                console.log(`X11: Map request for window id ${window.id} redirected by parent window id ${window.parent.id}`);
                return;
            }
        }

        window.x = props.x ?? window.x;
        window.y = props.y ?? window.y;
        window.width = props.width ?? window.width;
        window.height = props.height ?? window.height;

        this._syncDOM(window);

        const event = {
            type: XEventType.CONFIGURE_NOTIFY,
            display,
            window,
            x: props.x,
            y: props.y,
            width: props.width,
            height: props.height,
            value_mask: value_mask
        };

        if(this._checkEventMask(window.parent, XEventMask.SUBSTRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window.parent, event);
        }

        if(this._checkEventMask(window, XEventMask.STRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window, event);
        }
    }

    queryTree(display: XDisplay, window: XWindow) {
        return {
            root: this._rootWindow,
            parent: window.parent,
            children: window.children.slice()
        }
    }

    changeProperty(display: XDisplay, window: XWindow, prop: string, value: any) {
        window.props[prop] = value;

        this._maybeSendEvents(window, {
            type: XEventType.PROPERTY_NOTIFY,
            display,
            window,
            property_key: prop,
            property_value: value
        });
    }

    setWindowBackgroundColor(display: XDisplay, window: XWindow, color: string) {
        window.background_color = color;

        this._syncDOM(window);
    }

    mapWindow(display: XDisplay, window: XWindow) {
        if(window.mapped) {
            throw new Error(`X11: Window id ${window.id} is already mapped`);
        }

        if(!window.override_redirect && this._checkEventMask(window.parent, XEventMask.SUBSTRUCTURE_REDIRECT)) {
            if(this._maybeSendEvents(window.parent, {
                type: XEventType.MAP_REQUEST,
                display,
                window
            }, display)) {
                console.log(`X11: Map request for window id ${window.id} redirected by parent window id ${window.parent.id}`);
                return;
            }
        }

        //window.parent.dom.appendChild(window.dom);
        window.dom.style.display = "block";
        window.mapped = true;
        
        console.log(`X11: Mapped window id ${window.id} for display id ${display.id}`);

        /*
            it's important to attach the context when window is mapped, instead of when the context is attached,
            because for example Svelte 5 context, will fire the onMount callback immediately after the component is created,
            not when it's actually mounted in the DOM, so that might cause issues with immediate DOM manipulations or measurements
            that depend on the DOM being mounted.
        */
        if(this._contexts.has(window.id) && !this._contextUnmounts.has(window.id)) {
            const context = this._contexts.get(window.id)!;
            const unmount = context(window.dom);

            this._contextUnmounts.set(window.id, unmount);

            console.log(`X11: Mounted context for window id ${window.id}`);
        }

        const event = {
            type: XEventType.MAP_NOTIFY,
            display,
            window
        };

        if(this._checkEventMask(window.parent, XEventMask.SUBSTRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window.parent, event);
        }

        if(this._checkEventMask(window, XEventMask.STRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window, event);
        }        
    }

    unmapWindow(display: XDisplay, window: XWindow) {
        if(!window.mapped) {
            return;
        }

        /*if(this._contextUnmounts.has(window.id)) {
            this.destroyContext(display, window);
        }*/

        //window.parent.dom.removeChild(window.dom);
        window.dom.style.display = "none";
        window.mapped = false;

        console.log(`X11: Unmapping window id ${window.id} for display id ${display.id}`);

        const event = {
            type: XEventType.UNMAP_NOTIFY,
            display,
            window
        };

        if(this._checkEventMask(window.parent, XEventMask.SUBSTRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window.parent, event);
        }

        if(this._checkEventMask(window, XEventMask.STRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window, event);
        }        
    }

    getWindow(display: XDisplay, windowId: number) {
        const window = this._windows.get(windowId);
        if(!window) {
            throw new Error(`X11: Window id ${windowId} does not exist`);
        }

        return window;
    }

    raiseWindow(display: XDisplay, window: XWindow) {
        if(!window.parent) {
            throw new Error(`X11: Cannot raise window id ${window.id} without a parent`);
        }

        const parent = window.parent;
        if(!window.override_redirect && this._checkEventMask(parent, XEventMask.SUBSTRUCTURE_REDIRECT)) {
            if(this._maybeSendEvents(parent, {
                type: XEventType.CONFIGURE_REQUEST,
                display,
                window,
                above: parent.children[parent.children.length - 1],
                value_mask: XConfigureRequestMask.ABOVE
            }, display)) {
                console.log(`X11: Raise request for window id ${window.id} redirected by parent window id ${parent.id}`);
                return;
            }
        }

        console.log(`X11: Raising window id ${window.id} in parent window id ${parent.id}`);

        const index = parent.children.findIndex(c => c.id === window.id);
        if(index === -1) {
            throw new Error(`X11: Window id ${window.id} not found in parent window id ${parent.id} children`);
        }

        parent.children.splice(index, 1);
        parent.children.push(window);

        this._syncChildrenOrderDOM(parent);

        const event = {
            type: XEventType.CONFIGURE_NOTIFY,
            display,
            window,
            above: parent.children[parent.children.length - 2],
            value_mask: XConfigureRequestMask.ABOVE
        };

        if(this._checkEventMask(parent, XEventMask.SUBSTRUCTURE_NOTIFY)) {
            this._maybeSendEvents(parent, event);
        }

        if(this._checkEventMask(window, XEventMask.STRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window, event);
        }
    }

    lowerWindow(display: XDisplay, window: XWindow) {
        if(!window.parent) {
            throw new Error(`X11: Cannot lower window id ${window.id} without a parent`);
        }

        if(!window.override_redirect && this._checkEventMask(window.parent, XEventMask.SUBSTRUCTURE_REDIRECT)) {
            if(this._maybeSendEvents(window.parent, {
                type: XEventType.CONFIGURE_REQUEST,
                display,
                window,
                above: null!,
                value_mask: XConfigureRequestMask.ABOVE
            }, display)) {
                console.log(`X11: Lower request for window id ${window.id} redirected by parent window id ${window.parent.id}`);
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

        this._syncChildrenOrderDOM(parent);

        const event = {
            type: XEventType.CONFIGURE_NOTIFY,
            display,
            window,
            above: null!,
            value_mask: XConfigureRequestMask.ABOVE
        };

        if(this._checkEventMask(parent, XEventMask.SUBSTRUCTURE_NOTIFY)) {
            this._maybeSendEvents(parent, event);
        }

        if(this._checkEventMask(window, XEventMask.STRUCTURE_NOTIFY)) {
            this._maybeSendEvents(window, event);
        }
    }

    restackWindows(display: XDisplay, windows: XWindow[]) {
        if(windows.length === 0) {
            return;
        }

        const parent = windows[0].parent;
        if(!parent) {
            throw new Error(`X11: Cannot restack windows without a parent`);
        }

        for(const window of windows) {
            if(window.parent?.id !== parent.id) {
                throw new Error(`X11: Cannot restack windows from different parents (window id ${window.id} has parent id ${window.parent?.id}, expected parent id ${parent.id})`);
            }
        }

        let sent_substructure_redirect = false;
        const hasSubstructureRedirect = this._checkEventMask(parent, XEventMask.SUBSTRUCTURE_REDIRECT);

        const children = [...parent.children];
        for(let i = 1; i < windows.length; i++) {
            const window = windows[i];
            if(hasSubstructureRedirect && !window.override_redirect) {
                if(this._maybeSendEvents(parent, {
                    type: XEventType.CONFIGURE_REQUEST,
                    display,
                    window,
                    above: windows[i - 1],
                    value_mask: XConfigureRequestMask.ABOVE
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
            console.log(`X11: Restack request for windows redirected by parent window id ${parent.id}`);
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
        this._syncChildrenOrderDOM(parent);
    }

    reparentWindow(display: XDisplay, window: XWindow, newParent: XWindow, x: number, y: number) {
        if(window.parent) {
            window.parent.children = window.parent.children.filter(c => c.id !== window.id);
            window.parent.dom.removeChild(window.dom);
        }

        newParent.children.push(window);
        window.parent = newParent;

        newParent.dom.appendChild(window.dom);

        window.x = x;
        window.y = y;

        this._syncDOM(window);
        this._syncChildrenOrderDOM(newParent);
        this._syncChildrenOrderDOM(window.parent);
    }

    selectInput(display: XDisplay, window: XWindow, mask: number) {
        let subscribers = this._subscribers.get(window.id);
        if(!subscribers) {
            subscribers = new Map();
            this._subscribers.set(window.id, subscribers);
        }

        subscribers.set(display, mask);
    }

    sendEvent(display: XDisplay, window: XWindow, event: XEvent) {
        console.log(`X11: Sending event of type ${XEventType[event.type]} to window id ${window.id} for display id ${display.id}`);
        this._maybeSendEvents(window, event);
    }

    nextEvent(display: XDisplay): XEvent | null {
        return display.event_queue.shift() || null;
    }

    getRootWindow() {
        return this._rootWindow;
    }

    private _syncDOM(window: XWindow) {
        window.dom.style.left = `${window.x}px`;
        window.dom.style.top = `${window.y}px`;
        window.dom.style.width = `${window.width}px`;
        window.dom.style.height = `${window.height}px`;
        window.dom.style.backgroundColor = window.background_color;
    }

    private _syncChildrenOrderDOM(window: XWindow) {
        for(let i = 0; i < window.children.length; i++) {
            const child = window.children[i];
            child.dom.style.zIndex = `${i}`;
        }
    }

    private _maybeSendEvents(window: XWindow, event: XEvent, exclude?: XDisplay) {
        const subscribers = this._subscribers.get(window.id);
        if(!subscribers) {
            return false;
        }

        let send = false;
        for(const [display, mask] of subscribers) {
            if(exclude && display.id === exclude.id) {
                continue;
            }

            if(this._doesEventMatchMask(event, mask)) {
                display.event_queue.push(event);
                send = true;
            }
        }

        return send;
    }

    private _doesEventMatchMask(event: XEvent, mask: number) {
        if(event.type === XEventType.CLIENT_MESSAGE) {
            return true;
        }

        if(event.type === XEventType.CONFIGURE_REQUEST || event.type === XEventType.MAP_REQUEST) {
            return (mask & XEventMask.SUBSTRUCTURE_REDIRECT) === XEventMask.SUBSTRUCTURE_REDIRECT;
        }

        if((mask & XEventMask.SUBSTRUCTURE_NOTIFY) === XEventMask.SUBSTRUCTURE_NOTIFY && 
            (event.type === XEventType.CONFIGURE_NOTIFY || event.type === XEventType.MAP_NOTIFY ||
            event.type === XEventType.UNMAP_NOTIFY || event.type === XEventType.CREATE_NOTIFY ||
            event.type === XEventType.DESTROY_NOTIFY)) {
            return true;
        }

        if((mask & XEventMask.STRUCTURE_NOTIFY) === XEventMask.STRUCTURE_NOTIFY && 
            (event.type === XEventType.CONFIGURE_NOTIFY || event.type === XEventType.DESTROY_NOTIFY ||
            event.type === XEventType.MAP_NOTIFY || event.type === XEventType.UNMAP_NOTIFY)) {
            return true;
        }

        if(event.type === XEventType.PROPERTY_NOTIFY) {
            return (mask & XEventMask.PROPERTY_CHANGE) === XEventMask.PROPERTY_CHANGE;
        }

        return false;
    }

    private _checkEventMask(window: XWindow, mask: number) {
        const subscribers = this._subscribers.get(window.id);
        if(!subscribers) {
            return false;
        }

        for(const [display, subMask] of subscribers) {
            if((subMask & mask) === mask) {
                return true;
            }
        }

        return false;
    }
}