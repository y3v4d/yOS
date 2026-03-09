import context from "./context.svelte";

const x11 = include("y11");
const svelte = include("svelte");

let display;

export default async function(args) {
    const api = {
        on_mounted: async () => {
            const rootWindow = x11.getRootWindow(display);
            const clientList = await x11.getProperty(display, rootWindow, "_NET_CLIENT_LIST");
            const activeWindow = await x11.getProperty(display, rootWindow, "_NET_ACTIVE_WINDOW");
            
            const taskbarItems = await clientListToTaskbarItems(clientList || []);

            api.on_items_updated?.(taskbarItems);
            api.on_active_updated?.(activeWindow || null);
        }
    };

    display = await x11.openDisplay();
    const rootWindow = x11.getRootWindow(display);
    const window = await x11.createWindow(display, rootWindow);

    await x11.selectInput(display, rootWindow, 16);
    await x11.selectInput(display, window, 8);

    await x11.changeProperty(display, window, "_NET_WM_NAME", "yTaskbar");
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_DOCK");
    await x11.changeProperty(display, window, "_NET_WM_STRUT", {
        left: 0,
        right: 0,
        top: 0,
        bottom: 29
    });
    await x11.changeWindowBackgroundColor(display, window, "#202020");

    await x11.mapWindow(display, window);
    await x11.configureWindow(display, window, {
        width: rootWindow.width,
        height: 29,
        x: 0,
        y: rootWindow.height - 29
    });

    let has_context = false;
    let should_close = false;
    while(!should_close) {
        let event;
        while(event = x11.nextEvent(display)) {
            if(event.type === 6) {
                const key = event.property_key;
                if(key === "_NET_CLIENT_LIST") {
                    const clientList = event.property_value;
                    const taskbarItems = await clientListToTaskbarItems(clientList);
                    api.on_items_updated?.(taskbarItems);
                } else if(key === "_NET_ACTIVE_WINDOW") {
                    const activeWindow = event.property_value;
                    api.on_active_updated?.(activeWindow);
                }
            } else if(event.type === 4) {
                if(event.window.id === window.id && !has_context) {
                    x11.attachContext(window, svelte.createContext(context, {
                        api: api,
                        x11: x11,
                        display: display,
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

async function clientListToTaskbarItems(clientList) {
    const items = [];
    for(const client of clientList) {
        const type = await x11.getProperty(display, client, "_NET_WM_WINDOW_TYPE");
        if(type !== "_NET_WM_WINDOW_TYPE_NORMAL") {
            continue;
        }
        
        const title = await x11.getProperty(display, client, "_NET_WM_NAME") || "Unnamed Window";
        const icon = await x11.getProperty(display, client, "_NET_WM_ICON") || null;

        items.push({
            id: client.id,
            title: title,
            icon: icon
        });
    }

    return items;
}