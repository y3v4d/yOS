import readme_txt from "./assets/readme.txt?raw";
import links_txt from "./assets/links.txt?raw";
import credits_txt from "./assets/credits.txt?raw";
import about_me_txt from "./assets/about_me.txt?raw";
import about_this_txt from "./assets/about_this.txt?raw";
import changelog_txt from "./assets/changelog.txt?raw";

import icon_svelte_16 from "./assets/icon_svelte_16.png";
import icon_vue_32 from "./assets/icon_vue_32.png";
import icon_taskmanager_32 from "./assets/icon_taskmanager_32.png";

export default async function(args: any[]) {
    const apps = args[0] as Record<string, string>;
    const libs = args[1] as Record<string, string>;
    const isUrl = args[2] as boolean;

    console.log("Installer app started with args:", args);

    kernel.vfs.mkdir("/home/y3v4d/desktop");
    kernel.vfs.mkdir("/etc/applications");
    kernel.vfs.mkdir("/libs");

    for(const [name, src_or_url] of Object.entries(libs)) {
        let src: string;

        if(isUrl) {
            console.log(`Fetching lib "${name}" from ${src_or_url}...`);
            const response = await fetch(src_or_url);
            src = await response.text();
        } else {
            src = src_or_url;
        }

        create_lib_file(name, src);
    }

    for(const [name, src_or_url] of Object.entries(apps)) {
        let src: string;

        if(isUrl) {
            console.log(`Fetching app "${name}" from ${src_or_url}...`);
            const response = await fetch(src_or_url);
            src = await response.text();
        } else {
            src = src_or_url;
        }

        create_script_file(`/etc/applications/${name}`, src);
    }

    create_desktop_txt_file("readme", readme_txt);
    
    create_desktop_txt_file("about_me", about_me_txt);
    create_desktop_txt_file("about_this", about_this_txt);

    create_desktop_txt_file("links", links_txt);
    create_desktop_txt_file("changelog", changelog_txt);
    create_desktop_txt_file("credits", credits_txt);
    
    const utils = kernel.import("utils");
    const formatUtils = new utils.vfsFormat(kernel.vfs);

    formatUtils.createShortcut(
        "/home/y3v4d/desktop/Svelte 5 Demo",
        "/etc/applications/svelte-demo.exe",
        icon_svelte_16
    );

    formatUtils.createShortcut(
        "/home/y3v4d/desktop/Voxelly",
        "/etc/applications/browser.exe",
        undefined,
        { url: "https://y3v4d.com/voxelly", title: "Voxelly - IFrame" }
    );

    formatUtils.createShortcut(
        "/home/y3v4d/desktop/Match Mayhem",
        "/etc/applications/browser.exe",
        undefined,
        { url: "https://y3v4d.com/match3d", title: "Match Mayhem - IFrame", width: 300, height: 600 }
    );

    formatUtils.createShortcut(
        "/home/y3v4d/desktop/Wedding Planner",
        "/etc/applications/browser.exe",
        undefined,
        { 
            url: "https://y3v4d.com/svg-editor/?ballroom=873722c3-e55b-11f0-9030-0050569974dc", 
            title: "Wedding Planner - IFrame", 
            width: 1024, 
            height: 768 
        }
    );

    formatUtils.createShortcut(
        "/home/y3v4d/desktop/Musical Animals",
        "/etc/applications/browser.exe",
        undefined,
        { 
            url: "https://y3v4d.com/musical-animals", 
            title: "Musical Animals - IFrame", 
            width: 364, 
            height: 644 
        }
    );

    formatUtils.createShortcut(
        "/home/y3v4d/desktop/yTaskManager",
        "/etc/applications/taskmanager.exe",
        icon_taskmanager_32
    );

    formatUtils.createShortcut(
        "/home/y3v4d/desktop/Vue 3 Demo",
        "/etc/applications/vue3-demo.exe",
        icon_vue_32
    );
}

function create_desktop_txt_file(name: string, content: string) {
    const utils = kernel.import("utils");

    const fd = kernel.vfs.open(`/home/y3v4d/desktop/${name}.txt`);

    const encodedContent = new TextEncoder().encode(content);
    const binaryWriter = new utils.binaryWriter(4 + encodedContent.length);

    binaryWriter.uint32(encodedContent.length);
    binaryWriter.bytes(encodedContent);

    kernel.vfs.write(fd, binaryWriter.getBuffer());

    console.log(`Created text file /home/y3v4d/desktop/${name}.txt`);
}

function create_script_file(path: string, content: string) {
    const utils = kernel.import("utils");

    const fd = kernel.vfs.open(`${path}.exe`);

    const encodedContent = new TextEncoder().encode(content);
    const binaryWriter = new utils.binaryWriter(4 + encodedContent.length);

    binaryWriter.uint32(encodedContent.length);
    binaryWriter.bytes(encodedContent);

    kernel.vfs.write(fd, binaryWriter.getBuffer());

    console.log(`Created script file ${path}.exe`);
}

function create_lib_file(name: string, content: string) {
    const fd = kernel.vfs.open(`/libs/${name}.lib`);

    const encodedContent = new TextEncoder().encode(content);

    const data = new Uint8Array(4 + encodedContent.length);
    const view = new DataView(data.buffer);

    view.setUint32(0, encodedContent.length, true);
    data.set(encodedContent, 4);

    kernel.vfs.write(fd, data);

    console.log(`Created lib file /libs/${name}.lib`);
}