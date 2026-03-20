import WindowContext from "./window-context.svelte";

const x11 = include("y11");
const svelte = include("svelte");

const frames = [];
const clients = new Map();
const layers = {
    [0]: [],
    [1]: [],
    [2]: [],
    [3]: [],
    [4]: []
};

let display = null;
let isOnMobileDevice = null;
let rootWindow = null;

//console.log = () => {};

export default async function(args) {
    console.log("Starting yWM app with args:", args);
    console.log("yWM PID is:", kernel.getpid());

    display = await x11.openDisplay();
    console.log("yWM: Connected to X11 display, display id:", display.id);
    rootWindow = x11.getRootWindow(display);

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    isOnMobileDevice = rootWindow.width < 800 || isTouchDevice;

    console.log("yWM: Connected to X11 display, root window id:", rootWindow.id);

    await x11.selectInput(display, rootWindow, 2 | 16);
    
    let should_close = false;
    while(!should_close) {
        //console.log("Kernel: ywm start of main loop");
        let event;
        while(event = x11.nextEvent(display)) {
            if(event.type === 3) {
                console.log("yWindowManager: MAP_REQUEST event received");
                await processMapRequest(event);
            } else if(event.type === 1) {
                console.log("yWindowManager: CONFIGURE_REQUEST event received");
                await processConfigureRequest(event);
            } else if(event.type === 6) {
                await processPropertyNotify(event);
            } else if(event.type === 8) {
                console.log("yWindowManager: DESTROY_NOTIFY event received");
                await processDestroyNotify(event);
            } else if(event.type === 5) {
                console.log("yWindowManager: UNMAP_NOTIFY event received");
                await processUnmapNotify(event);
            }
        }

        //console.log(`ywm pid: ${kernel.getpid()}`);

        try {
            await kernel.yield();
        } catch(e) {
            should_close = true;
        }
    }

    console.log("yWM: Closing display connection and exiting.");
    for(const [, client] of clients) {
        for(const { element, type, listener } of client.domEvents) {
            element.removeEventListener(type, listener);
        }

        const frame = client.frame;
        const geometry = await x11.getGeometry(display, frame);

        await x11.reparentWindow(display, client.window, rootWindow, geometry.x, geometry.y);
        await x11.destroyWindow(display, frame);
    }

    await x11.changeProperty(display, rootWindow, "_NET_CLIENT_LIST", []);
    await x11.changeProperty(display, rootWindow, "_NET_CLIENT_LIST_STACKING", []);

    await x11.closeDisplay(display);
}

async function processUnmapNotify(event) {
    if(!display) return;

    const rootWindow = x11.getRootWindow(display);
    const activeWindow = await x11.getProperty(display, rootWindow, "_NET_ACTIVE_WINDOW");
    if(activeWindow.id === event.window.id) {
        const stackingWindows = layers[2].map(c => c.window).reverse();
        let newActiveWindow = null;

        for(let i = 0; i < stackingWindows.length; i++) {
            const candidate = stackingWindows[i];
            if(candidate.id !== event.window.id && candidate.mapped) {
                newActiveWindow = candidate;
                break;
            }
        }

        await x11.changeProperty(display, rootWindow, "_NET_ACTIVE_WINDOW", newActiveWindow);
    }

    const client = clients.get(event.window.id);
    if(!client) {
        console.log(`yWindowManager: No managed client found for window id ${event.window.id}, ignoring.`);
        return;
    }

    await x11.unmapWindow(display, client.frame);
}

async function processDestroyNotify(event) {
    if(!display) return;
    
    const client = clients.get(event.window.id);
    if(!client) {
        console.log(`yWindowManager: No managed client found for window id ${event.window.id}, ignoring.`);
        return;
    }

    await x11.destroyWindow(display, client.frame);
    clients.delete(event.window.id);

    const layerClients = layers[client.layer];
    const index = layerClients.findIndex(c => c.window.id === client.window.id);
    if(index !== -1) {
        layerClients.splice(index, 1);
    }

    const clientList = await x11.getProperty(display, x11.getRootWindow(display), "_NET_CLIENT_LIST") || [];
    const clientIndex = clientList.findIndex((w) => w.id === event.window.id);
    if(clientIndex !== -1) {
        clientList.splice(clientIndex, 1);
        await x11.changeProperty(display, x11.getRootWindow(display), "_NET_CLIENT_LIST", clientList);
    }

    syncWindowStacking();
}

async function processConfigureRequest(event) {
    if(!display) return;
    
    const client = clients.get(event.window.id);
    if(!client) {
        console.log(`yWindowManager: No managed client found for window id ${event.window.id}, handing back to X11.`);
        await x11.configureWindow(display, event.window, {
            x: event.x,
            y: event.y,
            width: event.width,
            height: event.height
        });

        return;
    }

    const frame = client.frame;
    const isTransformMask = event.value_mask !== undefined && (
        (event.value_mask & 1) !== 0 ||
        (event.value_mask & 2) !== 0 ||
        (event.value_mask & 4) !== 0 ||
        (event.value_mask & 8) !== 0
    );

    const isAboveMask = event.value_mask !== undefined &&
        (event.value_mask & 16) !== 0;
    
    if(isTransformMask) {
        const isNormalWindow = await x11.getProperty(display, event.window, "_NET_WM_WINDOW_TYPE") === "_NET_WM_WINDOW_TYPE_NORMAL";
        const shouldAllowResize = isNormalWindow && !isOnMobileDevice;

        if(!shouldAllowResize) {
            console.log(`yWindowManager: Ignoring configure request for window id ${event.window.id} because it's not a normal window or we're on a mobile device.`);
            return;
        }

        await x11.configureWindow(display, frame, {
            x: event.x,
            y: event.y,
            width: event.width ? event.width + client.borderWidth * 2 : undefined,
            height: event.height ? event.height + client.titlebarHeight + client.borderWidth * 2 : undefined
        });

        await x11.configureWindow(display, event.window, {
            width: event.width,
            height: event.height
        });
    } else if(isAboveMask) {
        console.log(`yWindowManager: Raising window id ${event.window.id}`);
        await x11.changeProperty(display, x11.getRootWindow(display), "_NET_ACTIVE_WINDOW", event.window);
        
        raiseClientWindow(client);
    }
}

async function processMapRequest(event) {
    if(!display) return;
    
    if(clients.has(event.window.id)) {
        const client = clients.get(event.window.id);
        console.log(`yWindowManager: Window id ${event.window.id} is already managed, just mapping.`);

        if(!client.window.mapped) {
            await x11.mapWindow(display, client.window);
        }

        await x11.mapWindow(display, client.frame);

        return;
    }

    const frame = await x11.createWindow(display, x11.getRootWindow(display));

    const layer = netWmWindowTypeToLayer(await x11.getProperty(display, event.window, "_NET_WM_WINDOW_TYPE"));
    const hasDecoration = shouldNetWmWindowTypeHaveDecoration(await x11.getProperty(display, event.window, "_NET_WM_WINDOW_TYPE"));

    const client = {
        ipc: {},
        frame: frame,
        window: event.window,
        layer: layer,
        borderWidth: hasDecoration ? 4 : 0,
        titlebarHeight: hasDecoration ? 21 : 0,
        domEvents: []
    };

    const currentTitle = await x11.getProperty(display, event.window, "_NET_WM_NAME") || "Untitled Window";
    const windowType = await x11.getProperty(display, event.window, "_NET_WM_WINDOW_TYPE") || "_NET_WM_WINDOW_TYPE_NORMAL";
    const windowGeometry = await x11.getGeometry(display, event.window);

    await x11.selectInput(display, frame, 2 | 4);
    await x11.changeProperty(display, frame, "_NET_WM_NAME", currentTitle + " - yFrame");

    if(isOnMobileDevice && windowType === "_NET_WM_WINDOW_TYPE_NORMAL") {
        await x11.configureWindow(display, frame, {
            width: rootWindow.width,
            height: rootWindow.height - 29,
            x: 0,
            y: 0
        });
    } else {
        await x11.configureWindow(display, frame, {
            width: windowGeometry.width + client.borderWidth * 2,
            height: windowGeometry.height + client.titlebarHeight + client.borderWidth * 2,
            x: windowGeometry.x,
            y: windowGeometry.y
        });
    }

    if(hasDecoration) {
        x11.attachContext(frame, svelte.createContext(WindowContext, {
            x11: x11,
            display: display,
            client: client,
            isOnMobileDevice: isOnMobileDevice
        }));
    }
    
    await x11.reparentWindow(display, event.window, frame, client.borderWidth, client.titlebarHeight + client.borderWidth);

    if(isOnMobileDevice && windowType === "_NET_WM_WINDOW_TYPE_NORMAL") {
        await x11.configureWindow(display, event.window, {
            width: rootWindow.width - client.borderWidth * 2,
            height: rootWindow.height - 29 - client.titlebarHeight - client.borderWidth * 2,
        });
    }

    const windowMouseDownListener = async () => {
        if(!display) return;

        console.log(`yWindowManager: Window id ${event.window.id} received mousedown, raising.`);
        await x11.changeProperty(display, x11.getRootWindow(display), "_NET_ACTIVE_WINDOW", event.window);
        
        raiseClientWindow(client);
    };

    const domElement = document.getElementById(`window-${event.window.id}`);
    domElement.addEventListener("mousedown", windowMouseDownListener);
    client.domEvents.push({
        element: domElement,
        type: "mousedown",
        listener: windowMouseDownListener
    });

    frames.push(frame);
    clients.set(event.window.id, client);
    layers[layer].push(client);

    syncWindowStacking();

    await x11.mapWindow(display, frame);
    await x11.mapWindow(display, event.window);

    const clientList = await x11.getProperty(display, x11.getRootWindow(display), "_NET_CLIENT_LIST") || [];
    clientList.push(event.window);

    await x11.changeProperty(display, x11.getRootWindow(display), "_NET_CLIENT_LIST", clientList);
}

async function processPropertyNotify(event) {
    if(!display) return;
    
    if(event.property_key === "_NET_ACTIVE_WINDOW") {
        console.log(event);
        console.log("yWindowManager: PROPERTY_NOTIFY event for _NET_ACTIVE_WINDOW received");

        const activeWindow = event.property_value;
        if(!activeWindow) {
            console.log("yWindowManager: No active window, skipping.");
            return;
        }
        
        const client = clients.get(activeWindow.id);
        if(!client) {
            console.warn(`yWindowManager: No managed client found for window id ${activeWindow.id}`);
            return;
        }

        await raiseClientWindow(client);
        for(const [_, client] of clients) {
            client.ipc.on_active_window_changed?.(activeWindow.id);
        }
    }
}

async function raiseClientWindow(client) {
    if(!display) return;

    const layerClients = layers[client.layer];
    const index = layerClients.findIndex(c => c.window.id === client.window.id);
    if(index === -1) {
        console.warn(`yWindowManager: Client window id ${client.window.id} not found in its layer`);
        return;
    }

    layerClients.splice(index, 1);
    layerClients.push(client);

    await syncWindowStacking();
}

async function syncWindowStacking() {
    if(!display) return;

    const windowStack = [
        ...layers[0],
        ...layers[1],
        ...layers[2],
        ...layers[3],
        ...layers[4]
    ].reverse();

    await x11.restackWindows(display, windowStack.map(c => c.frame));
    await x11.changeProperty(display, x11.getRootWindow(display), "_NET_CLIENT_LIST_STACKING", windowStack.map(c => c.window));
}

function shouldNetWmWindowTypeHaveDecoration(type) {
    switch(type) {
        case "_NET_WM_WINDOW_TYPE_DESKTOP":
        case "_NET_WM_WINDOW_TYPE_DOCK":
        case "_NET_WM_WINDOW_TYPE_TOOLBAR":
        case "_NET_WM_WINDOW_TYPE_MENU":
        case "_NET_WM_WINDOW_TYPE_UTILITY":
        case "_NET_WM_WINDOW_TYPE_SPLASH":
        case "_NET_WM_WINDOW_TYPE_DIALOG":
        case "_NET_WM_WINDOW_TYPE_DROPDOWN_MENU":
        case "_NET_WM_WINDOW_TYPE_POPUP_MENU":
        case "_NET_WM_WINDOW_TYPE_TOOLTIP":
        case "_NET_WM_WINDOW_TYPE_NOTIFICATION":
        case "_NET_WM_WINDOW_TYPE_COMBO":
        case "_NET_WM_WINDOW_TYPE_DND":
        case "_NET_WM_WINDOW_TYPE_SCREENSAVER":
            return false;
        case "_NET_WM_WINDOW_TYPE_NORMAL":
        default:
            return true;
    }
}

function netWmWindowTypeToLayer(type) {
    switch(type) {
        case "_NET_WM_WINDOW_TYPE_DESKTOP":
            return 1;
        case "_NET_WM_WINDOW_TYPE_DOCK":
        case "_NET_WM_WINDOW_TYPE_TOOLBAR":
        case "_NET_WM_WINDOW_TYPE_MENU":
        case "_NET_WM_WINDOW_TYPE_UTILITY":
        case "_NET_WM_WINDOW_TYPE_SPLASH":
        case "_NET_WM_WINDOW_TYPE_DIALOG":
        case "_NET_WM_WINDOW_TYPE_DROPDOWN_MENU":
        case "_NET_WM_WINDOW_TYPE_POPUP_MENU":
        case "_NET_WM_WINDOW_TYPE_TOOLTIP":
        case "_NET_WM_WINDOW_TYPE_NOTIFICATION":
        case "_NET_WM_WINDOW_TYPE_COMBO":
        case "_NET_WM_WINDOW_TYPE_DND":
            return 3;
        case "_NET_WM_WINDOW_TYPE_SCREENSAVER":
            return 4;
        case "_NET_WM_WINDOW_TYPE_NORMAL":
        default:
            return 2;
    }
}