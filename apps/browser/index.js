const x11 = include("y11");

export default async function(args) {
    const props = args[0];

    const display = await x11.openDisplay();
    const window = await x11.createWindow(display, x11.getRootWindow(display));

    await x11.changeProperty(display, window, "_NET_WM_NAME", props.title || "yBrowser");
    await x11.changeProperty(display, window, "_NET_WM_ICON_NAME", props.icon || "");
    await x11.changeProperty(display, window, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_NORMAL");
    await x11.changeWindowBackgroundColor(display, window, "#FFFFFF");

    x11.attachContext(window, (root) => {
        const container = document.createElement("div");
        container.classList.add("content-decorated");

        root.appendChild(container);

        const iframe = document.createElement("iframe");

        iframe.src = props.url;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";

        container.appendChild(iframe);

        return () => {
            root.removeChild(container);
        };
    });

    await x11.configureWindow(display, window, {
        x: 100,
        y: 100,
        width: props.width ?? 800,
        height: props.height ?? 600,
    });

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