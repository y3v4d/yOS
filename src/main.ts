import './app.css'
import './yos/index';

import { Kernel } from './yos/core/kernel';
import { X11 } from './yos/core/x11';
import icon_svelte_16 from "./assets/icons/icon_svelte_16.png";
import icon_vue_32 from "./assets/icons/icon_vue_32.png";
import icon_taskmanager_32 from "./assets/icons/icon_taskmanager_32.png";
import { init_files } from './init_files';
import { VfsFormtUtils } from './yos/utils/vfs-utils';

const kernel = new Kernel();
const x11 = new X11(kernel, document.body);

kernel.audio.preload("/sfx/click.mp3");
kernel.registerLibrary(x11);

const appFiles = import.meta.glob("./apps/*.{svelte,ts,js}");
console.log("App files:", appFiles);

async function main() {
  const yWmModule = await import("./apps/app-ywm");
  const yDesktopModule = await import("./apps/app-ydesktop");
  const yTaskbarModule = await import("./apps/app-ytaskbar");
  const yNotepadModule = await import("./apps/app-ynotepad");
  const yBrowserModule = await import("./apps/app-ybrowser");
  const vue3ContextDemoModule = await import("./apps/app-vue3-context-demo");
  const svelteContextDemoModule = await import("./apps/app-svelte-context-demo");
  const yTaskManagerModule = await import("./apps/app-ytaskmanager");

  kernel.registry.set("app-ywm", yWmModule.yWM);
  kernel.registry.set("app-ydesktop", yDesktopModule.yDesktop);
  kernel.registry.set("app-ytaskbar", yTaskbarModule.yTaskbar);
  kernel.registry.set("app-ynotepad", yNotepadModule.yNotepad);
  kernel.registry.set("app-vue3-context-demo", vue3ContextDemoModule.Vue3ContextDemo);
  kernel.registry.set("app-svelte-context-demo", svelteContextDemoModule.SvelteContextDemo);
  kernel.registry.set("app-ybrowser", yBrowserModule.yBrowser);
  kernel.registry.set("app-ytaskmanager", yTaskManagerModule.yTaskManager);

  kernel.registry.set("ext-txt-application", "app-ynotepad");

  //kernel.spawnProcess(yWmModule.yWM);
  //kernel.spawnProcess(yDesktopModule.yDesktop);
  //kernel.spawnProcess(yTaskbarModule.yTaskbar);

  const tick = () => {
    kernel.tick();
    requestAnimationFrame(tick);
  };

  tick();

/*async function installDevApp(app_file: string) {
  const url = `http://localhost:5173/src/apps/${app_file}`;

  const response = await fetch(url);
  const jsCode = await response.text();

  console.log(`Installing dev app from ${url}...`);
  console.log("Fetched JS code:", jsCode);

  const blob = new Blob([jsCode], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const module = await import(blobUrl);
    console.log("Imported module:", module);
  } catch (error) {
    console.error("Error importing module:", error);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

installDevApp("app-ydesktop.svelte");*/

  /*const display = x11.openDisplay();

  const popup = x11.createWindow(display, x11.getRootWindow());

  x11.setWindowBackgroundColor(display, popup, "#FFFFE0");
  x11.changeProperty(display, popup, "_NET_WM_NAME", "Popup Window");
  x11.changeProperty(display, popup, "_NET_WM_WINDOW_TYPE", "_NET_WM_WINDOW_TYPE_POPUP_MENU");
  x11.attachContext(display, popup, createVueContext({
    data() {
      return {
        visible: true
      }
    },
    template: `
      <div v-if="visible" style="padding: 2px 8px; border: 1px solid black; height: 100%;">
        <h2 style="padding: 8px 0px; margin: 0px;">Popup Window</h2>
        <p>This is a popup window using Vue 3 context!</p>
      </div>
    `
  }, {}));

  x11.mapWindow(display, popup);
  x11.configureWindow(display, popup, {
      width: 200,
      height: 70,
      x: window.innerWidth - 204,
      y: window.innerHeight - 99
  });*/

  init_files(kernel);

  kernel.vfs.mkdir("/tmp/test");
  kernel.vfs.mkdir("/etc/applications");

  const formatUtils = new VfsFormtUtils(kernel.vfs);

  formatUtils.createExecutable(
    "/etc/applications/yWM",
    "app-ywm"
  );

  formatUtils.createExecutable(
    "/etc/applications/yDesktop",
    "app-ydesktop"
  );

  formatUtils.createExecutable(
    "/etc/applications/yTaskbar",
    "app-ytaskbar"
  );

  formatUtils.createExecutable(
    "/etc/applications/yNotepad",
    "app-ynotepad"
  );

  formatUtils.createExecutable(
    "/home/y3v4d/desktop/yTaskManager",
    "app-ytaskmanager",
    icon_taskmanager_32
  );

  formatUtils.createExecutable(
    "/home/y3v4d/desktop/Vue 3 Context Demo",
    "app-vue3-context-demo",
    icon_vue_32
  );

  formatUtils.createExecutable(
    "/home/y3v4d/desktop/Svelte 5 Context Demo",
    "app-svelte-context-demo",
    icon_svelte_16
  );

  formatUtils.createExecutable(
    "/home/y3v4d/desktop/Voxelly",
    "app-ybrowser",
    undefined,
    { url: "https://y3v4d.com/voxelly", title: "Voxelly - IFrame" }
  );

  formatUtils.createExecutable(
    "/home/y3v4d/desktop/Match Mayhem",
    "app-ybrowser",
    undefined,
    { url: "https://y3v4d.com/match3d", title: "Match Mayhem - IFrame", width: 300, height: 600 }
  );

  setTimeout(() => {
    console.log("VFS Structure:");

    //kernel.vfs.printStructure();
    //kernel.vfs.printBlocks();

    const dir = kernel.vfs.opendir("/home/y3v4d/desktop");
    const entires = [];

    let entry;
    while(entry = kernel.vfs.readdir(dir)) {
      entires.push(entry);
    }

    //console.log("Directory entries in /home/y3v4d/desktop:", entires);
  }, 1000);

  kernel.execve("/etc/applications/yWM.exe");
  kernel.execve("/etc/applications/yDesktop.exe");
  kernel.execve("/etc/applications/yTaskbar.exe");
}

/*window.oncontextmenu = (e) => {
  e.preventDefault();
  return false;
};*/

main();