import './app.css';
import './yos/index';

import { Kernel } from './yos/core/kernel';

import { apps, appUrls } from "virtual:apps";
import { libs, libUrls } from "virtual:libs";
import { IDBDriver } from './yos/core/idb_driver';

async function main() {
  //await IDBDriver.delete("yos-vfs");
  const kernel = await Kernel.create(2);

  kernel.audio.preload("/sfx/click.mp3");
  kernel.registry.set("ext-txt-application", "app-ynotepad");

  const installerNeeded = await is_installer_needed(kernel);
  if(installerNeeded) {
    console.log("Installer is needed, launching installer...");
    await launch_installer(kernel);
  } else {
    console.log("Installer is not needed, skipping installer.");
  }

  await kernel.execve("/etc/applications/y11.exe");
  await kernel.waitFor("y11:ready"); // mostly wait for the socket

  await kernel.execve("/etc/applications/ywm.exe");
  await kernel.execve("/etc/applications/desktop.exe");
  await kernel.execve("/etc/applications/taskbar.exe");
}

async function is_installer_needed(kernel: Kernel): Promise<boolean> {
    try {
        const fd = await kernel.vfs.open("/etc/installer_done");
        await kernel.vfs.read(fd, 100);
        return false;
    } catch (e) {
        return true;
    }
}

async function launch_installer(kernel: Kernel) {
  let installerCode: string;

  if(appUrls && appUrls["installer"]) {
    console.log(`Fetching installer app from ${appUrls["installer"]}...`);

    const response = await fetch(appUrls["installer"]);
    installerCode = await response.text();
  } else if(apps && apps["installer"]) {
    installerCode = apps["installer"];
  } else {
    throw new Error("Installer app not found!");
  }

  const process = await kernel.exec(installerCode, apps ?? appUrls, libs ?? libUrls, !!appUrls);
  while(!process.is_dead) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

document.addEventListener('gesturestart', function (e) {
    //e.preventDefault(); // iOS pinch zoom
});

/*window.oncontextmenu = (e) => {
  e.preventDefault();
  return false;
};*/

main();