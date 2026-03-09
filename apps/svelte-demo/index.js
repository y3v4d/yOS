import icon_svelte_16 from "./assets/icon_svelte_16.png";
import context from "./context.svelte";

const x11 = include("y11");
const svelte = include("svelte");

export default async function(args) {
    const display = await x11.openDisplay();
    const window = await x11.createWindow(display, x11.getRootWindow(display));

    await x11.changeProperty(display, window, "_NET_WM_NAME", "Svelte 5 Demo");
    await x11.changeProperty(display, window, "_NET_WM_ICON", icon_svelte_16);
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");

    await x11.changeWindowBackgroundColor(display, window, "#F0F0F0");
    await x11.configureWindow(display, window, {
        x: 16,
        y: 16
    });
    console.log(svelte);

    x11.attachContext(window, svelte.createContext(context, {}));
    await x11.mapWindow(display, window);
    await x11.raiseWindow(display, window);

    let should_close = false;
    while(!should_close) {
        let event;
        while(event = x11.nextEvent(display)) {
            if(event.type === 99) {
                if(event.client_message_type === "WM_DELETE_WINDOW") {
                    should_close = true;
                }
            }
        }

        await kernel.yield();
    }
    
    await x11.destroyWindow(display, window);
    await x11.closeDisplay(display);
}