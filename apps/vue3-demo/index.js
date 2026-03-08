import icon_vue_16 from "./assets/icon_vue_16.png";

const x11 = kernel.import("y11");
const vue3 = kernel.import("vue3");

export default async function(args) {

    const display = await x11.openDisplay();
    const window = await x11.createWindow(display, x11.getRootWindow(display));

    await x11.selectInput(display, window, 8); // STRUCTURE_NOTIFY
    
    await x11.changeProperty(display, window, "_NET_WM_NAME", "Vue 3 Context Demo");
    await x11.changeProperty(display, window, "_NET_WM_ICON", icon_vue_16);
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");
    await x11.changeWindowBackgroundColor(display, window, "#F0F0F0");
    
    await x11.configureWindow(display, window, {
        x: 200,
        y: 200,
        width: 300,
        height: 200,
    });
    
    await x11.mapWindow(display, window);
    await x11.raiseWindow(display, window);

    let has_context = false;
    let should_close = false;
    while(!should_close) {
        let event;
        while(event = x11.nextEvent(display)) {
            if(event.type === 99) {
                if(event.client_message_type === "WM_DELETE_WINDOW") {
                    should_close = true;
                }
            } else if(event.type === 4) {
                if(event.window.id === window.id && !has_context) {
                    console.log("Attaching Vue 3 context...");
                    x11.attachContext(window, vue3.createContext({
                        setup() {
                            return {
                                message: "Hello from Vue 3!"
                            }
                        },
                        template: `
                            <div class="content-decorated" style="padding: 8px; background-color: white;">
                                <h1>{{ message }}</h1>
                                <p>This window is running a Vue 3 powered context!</p>
                            </div>
                        `}, 
                    {}));
                    has_context = true;
                }
            }
        }

        await kernel.yield();
    }

    await x11.destroyWindow(display, window);
    await x11.closeDisplay(display);
}