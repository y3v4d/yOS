import context from "./context.svelte";
import icon_taskmanager_16 from "./assets/icon_taskmanager_16.png";

const x11 = kernel.import("y11");
const svelte = kernel.import("svelte");

let display;

export default async function(args) {
    const ipc = {
        on_context_mount: async () => {
            const rootWindow = x11.getRootWindow(display);
            const clientList = await x11.getProperty(display, rootWindow, "_NET_CLIENT_LIST") || [];
            const applications = await clientListToAppInfos(clientList);

            ipc.update_processes?.(kernel.listProcesses());
            ipc.update_applications?.(applications);
        },

        on_kill_process: (pid) => {
            console.log(`Killing process with PID ${pid}`);
            kernel.killProcess(pid);
        },

        on_kill_application: async (windowId) => {
            const rootWindow = x11.getRootWindow(display);
            const clientList = await x11.getProperty(display, rootWindow, "_NET_CLIENT_LIST") || [];
            const targetClient = clientList.find(client => client.id === windowId);

            if(targetClient) {
                x11.sendEvent(display, targetClient, {
                    windowId: targetClient.id,
                    
                    type: 99,
                    client_message_type: "WM_DELETE_WINDOW"
                });
            }
        }
    };

    const kernelEvents = kernel.subscribe();
    display = await x11.openDisplay();

    const rootWindow = x11.getRootWindow(display);
    const window = await x11.createWindow(display, rootWindow);

    await x11.selectInput(display, rootWindow, 16); // PROPERTY_CHANGE
    await x11.selectInput(display, window, 8); // STRUCTURE_NOTIFY 

    await x11.changeProperty(display, window, "_NET_WM_NAME", "yTaskManager");

    await x11.changeProperty(display, window, "_NET_WM_ICON", icon_taskmanager_16);
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");

    await x11.changeWindowBackgroundColor(display, window, "#FFFFFF");
    await x11.configureWindow(display, window, {
        width: 400,
        height: 400,
        x: 100,
        y: 100
    });

    await x11.mapWindow(display, window);
    await x11.raiseWindow(display, window);

    let has_context = false;
    let should_close = false;
    while(!should_close) {
        let kernelEvent;
        while(kernelEvent = kernelEvents.next()) {
            if(kernelEvent.type === "process:spawned" || kernelEvent.type === "process:killed") {
                ipc.update_processes?.(kernel.listProcesses());
            }
        }

        let event;
        while(event = x11.nextEvent(display)) {
            if(event.type === 99) {
                if(event.client_message_type === "WM_DELETE_WINDOW") {
                    should_close = true;
                }
            } else if(event.type === 6) {
                if(event.property_key === "_NET_CLIENT_LIST") {
                    const clients = event.property_value;
                    const applications = await clientListToAppInfos(clients);

                    ipc.update_applications?.(applications);
                }
            } else if(event.type === 4) {
                if(event.window.id === window.id && !has_context) {
                    x11.attachContext(window, svelte.createContext(context, {
                        ipc: ipc
                    }));
                    has_context = true;
                }
            }
        }

        await kernel.yield();
    }

    kernel.unsubscribe(kernelEvents);

    await x11.destroyWindow(display, window);
    await x11.closeDisplay(display);

    async function clientListToAppInfos(clientList) {
        const appInfos = [];
        for(const client of clientList) {
            const type = await x11.getProperty(display, client, "_NET_WM_WINDOW_TYPE");
            if(type !== "_NET_WM_WINDOW_TYPE_NORMAL") {
                continue;
            }

            const title = await x11.getProperty(display, client, "_NET_WM_NAME") || null;
            const icon = await x11.getProperty(display, client, "_NET_WM_ICON") || null;

            appInfos.push({
                windowId: client.id,
                title: title || "Unknown",
                icon: icon
            });
        }

        return appInfos;
    }
}