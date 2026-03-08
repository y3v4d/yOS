import './app.css';
import './yos/index';

import { Kernel } from './yos/core/kernel';

import { apps, appUrls } from "virtual:apps";
import { libs, libUrls } from "virtual:libs";

const kernel = new Kernel();

kernel.audio.preload("/sfx/click.mp3");

async function main() {
  kernel.registry.set("ext-txt-application", "app-ynotepad");

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

  const process = kernel.exec(installerCode, apps ?? appUrls, libs ?? libUrls, !!appUrls);
  while(!process.is_dead) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  kernel.execve("/etc/applications/y11.exe");
  kernel.execve("/etc/applications/ywm.exe");
  kernel.execve("/etc/applications/desktop.exe");
  kernel.execve("/etc/applications/taskbar.exe");

  /*
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
  */
}

/*window.oncontextmenu = (e) => {
  e.preventDefault();
  return false;
};*/

main();