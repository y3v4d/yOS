import icon_svelte_16 from "./assets/icon_svelte_16.png";

enum XEventMask {
    NONE = 0,
    SUBSTRUCTURE_REDIRECT = 1 << 1,
    SUBSTRUCTURE_NOTIFY = 1 << 2,
    STRUCTURE_NOTIFY = 1 << 3,
    PROPERTY_CHANGE = 1 << 4
}

export default async function(args: any[]) {
    console.log("Hello from y11-test app!", args);

    const y11 = load<Y11>("y11");
    if(!y11) {
        throw new Error("Y11 library not found");
    }
    
    const display = await y11.openDisplay();
    console.log("Opened display with socket id:", display.socket.id);

    const window = await y11.createWindow(display, y11.getRootWindow(display));
    const secondWindow = await y11.createWindow(display, y11.getRootWindow(display));

    await y11.selectInput(display, window, XEventMask.PROPERTY_CHANGE);
    await y11.mapWindow(display, window);
    await y11.mapWindow(display, secondWindow);

    y11.attachContext(window, (root) => {
        const div = document.createElement("div");
        div.textContent = "Hello from Y11 Window!";
        div.style.color = "black";
        div.style.fontSize = "24px";
        div.style.display = "flex";
        div.style.justifyContent = "center";
        div.style.alignItems = "center";
        div.style.height = "100%";

        root.appendChild(div);

        return () => {
            root.removeChild(div);
        }
    });

    y11.attachContext(secondWindow, (root) => {
        const div = document.createElement("div");
        div.textContent = "Second Window";
        div.style.color = "black";
        div.style.fontSize = "24px";
        div.style.display = "flex";
        div.style.justifyContent = "center";
        div.style.alignItems = "center";
        div.style.height = "100%";

        root.appendChild(div);

        return () => {
            root.removeChild(div);
        }
    });

    await y11.changeWindowBackgroundColor(display, window, "#FF0000");
    await y11.changeProperty(display, window, "_NET_WM_NAME", "Test Window");
    await y11.changeProperty(display, window, "_NET_WM_ICON", icon_svelte_16);

    const tree = await y11.queryTree(display, secondWindow);
    console.log("Window tree:", tree);

    let closed_windows = 0;
    let should_close = false;
    while(!should_close) {
        let event;
        while(event = y11.nextEvent(display)) {
            //console.log("Received event:", event);
            if(event.type === 99 && event.client_message_type === "WM_DELETE_WINDOW") {
                console.log("Received close event for window id", event.window.id);
                await y11.destroyWindow(display, event.window);
                closed_windows++;
                if(closed_windows >= 2) {
                    should_close = true;
                }
            }
        }

        await kernel.yield();
    }
    //await kernel.yield();

    y11.closeDisplay(display);
    console.log("Closed display, exiting y11-test app.");
}