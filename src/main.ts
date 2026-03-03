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
    "/etc/applications/yBrowser",
    "app-ybrowser"
  );

  formatUtils.createExecutable(
    "/etc/applications/yTaskManager",
    "app-ytaskmanager",
    icon_taskmanager_32
  );

  formatUtils.createExecutable(
    "/etc/applications/vue3-context-demo",
    "app-vue3-context-demo",
    icon_vue_32
  );

  formatUtils.createExecutable(
    "/etc/applications/svelte-context-demo",
    "app-svelte-context-demo",
    icon_svelte_16
  );

  formatUtils.createShortcut(
    "/home/y3v4d/desktop/Voxelly",
    "/etc/applications/yBrowser.exe",
    undefined,
    { url: "https://y3v4d.com/voxelly", title: "Voxelly - IFrame" }
  );

  formatUtils.createShortcut(
    "/home/y3v4d/desktop/Match Mayhem",
    "/etc/applications/yBrowser.exe",
    undefined,
    { url: "https://y3v4d.com/match3d", title: "Match Mayhem - IFrame", width: 300, height: 600 }
  );

  formatUtils.createShortcut(
    "/home/y3v4d/desktop/yTaskManager",
    "/etc/applications/yTaskManager.exe"
  );

  formatUtils.createShortcut(
    "/home/y3v4d/desktop/Vue 3 Context Demo",
    "/etc/applications/vue3-context-demo.exe"
  );

  formatUtils.createShortcut(
    "/home/y3v4d/desktop/Svelte Context Demo",
    "/etc/applications/svelte-context-demo.exe"
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