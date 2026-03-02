import { BinaryWriter, type Kernel } from "./yos";

const readmeContent = `yOS - Web Operating System v0.3.0
--------------------------------------------------

Welcome to yOS, an experimental operating system-like environment built using TypeScript.
This README file will guide you through the basic features and functionalities of yOS.

Desktop:
- The desktop serves as the main workspace where you can find icons representing various applications and files.
- Double-click on an icon to open the corresponding application or file.
- Right-click on the desktop to access context menus for additional options. (TODO)

Display server:
- yOS utilizes an X11-inspired display server for managing windows and rendering the graphical interface.
- The display server handles window creation, movement, resizing, and layering.

Window Management:
- Built on top of the display server, yOS includes a Window 2000-themed window management system.
- Applications open in separate windows that can be moved, resized, minimized, and closed.
- Click and drag the title bar of a window to move it around the desktop.
- Use the resize handles at the edges and corners of a window to adjust its size.
- Minimize windows to the taskbar and restore them by clicking on their taskbar icons.

Taskbar:
- The taskbar at the bottom of the screen provides quick access to open applications and system functions.
- Click on an application icon in the taskbar to bring its window to the foreground.
- The system tray displays important information such as time and notifications. (TODO)

File System:
- yOS features a virtual file system where you can create, read, update, and delete files and directories.
- Use the built-in text editor application to create and edit text files.
- Files can be organized on the desktop or within directories in the file system. (TODO)

Audio Feedback:
- yOS includes audio feedback for various interactions, enhancing the user experience.
- Sounds are played for actions such as opening applications, clicking icons, and closing windows. (TODO)

Getting Help:
- For more information about specific applications or features, refer to the individual documentation provided within each application. (TODO)
- Explore the included text files on the desktop for additional details about yOS, its development, and credits.

Enjoy exploring yOS!`;

const linksContent = `LINKS
-----------------

Email: y3v4d@proton.me

Github: https://github.com/y3v4d
Repository: https://github.com/y3v4d/yOS

Fiverr: https://www.fiverr.com/y3v4d_
Upwork: https://www.upwork.com/freelancers/~01fa7d5d247e88fa2b`;

const creditsContent = `This project uses a recreation of classic Windows-style UI for educational and portfolio purposes only.
It is not affiliated with or endorsed by Microsoft.

Design and assets are heavily inspired by Windows 2000.
Design reference: Figma file by PatrickWindowsConcept - https://www.figma.com/community/file/1335360360324685855

All rights to Microsoft and their respective owners.

yOS - Copyright (c) 2026 y3v4d`;

const aboutMeContent = `ABOUT ME
-------------

Hello! 
I'm Bartlomiej Wethacz (y3v4d), a passionate software developer with a love for creating low-level applications and exploring new technologies.

I specialize in game development, low-level programming and web development.
I enjoy working on projects that challenge me and allow me to learn and grow as a developer.

Feel free to reach out if you'd like to work with me or learn more about my work!`;

const aboutThisContent = `ABOUT yOS
----------------

yOS is an experimental operating system-like environment built using TypeScript.

It was originally created as simple a OS looking website to showcase my other projects in an fun and interactive way. 
Desktop, Toolbar or application windows were nothing more than simple Svelte components, without any OS resembling structure underneath them, but has since evolved into a more complex project.

Currently, yOS core is fully web framework-agnostic and features kernel, virtual file system, audio core, registry and X11-inspired display server.
Everything else is built as applications or libraries that run on top of the core.

Included applications, like yWM (window manager), yDesktop, yTaskbar etc., are built using Svelte 5 renderer, utilizing context API for seamless integration with the underlying yOS core.
It is also possible to attach other UI frameworks via the context system, as demonstrated in the Vue 3 Context Demo application.

This project is a work in progress and is constantly evolving as I learn and experiment with new ideas.
`;

const changelogContent = `CHANGELOG
------------------

Version 0.3.0 - 02/03/2026

- Rewritten the entire project to use a core-kernel architecture with core modules, applications and libraries running on top of it.
- Project no longer uses SvelteKit as the base for the OS internals, instead using plain Vite + TypeScript setup.
- Project is now framework-agnostic, with Svelte 5 used only for rendering applications and UI components.
- Moved project to use Vite + Svelte build system instead of SvelteKit.
- Added process management system to the kernel for spawning and managing applications and processes.
- Added virtual file system (VFS) with basic file and directory operations.
- Added audio core for managing audio playback and sound effects.
- Added registry for storing and retrieving global entries like executables and applications.
- Added X11-inspired display server.
- Added yWM window manager built on top of the X11-inspired display server with draggable and resizable windows.
- Added yDesktop application to serve as the main desktop environment with wallpaper and desktop icons.
- Added yTaskbar application to serve as the taskbar with start menu, application list and system tray.
- All applications rewritten to run on top of the new core architecture, but still utilize Svelte 5 for rendering.
- Added yTaskManager application to view and manage running applications and processes.
- Added yNotepad application to view and edit text files from the virtual file system.
- Added Svelte and Vue context demos as applications to showcase the context integration system.
- Updated desktop icons to launch applications via the new kernel process spawning system.
- Added disk stored executable file format.
- Added audio feedback for desktop icon interactions.
- Redone README file.
- Added ABOUT_THIS file.

Version 0.2.0 - 21/01/2026

- Added og MS Sans Serif font
- Added Process that consists of component constructor and parameters
- Added OSContextProvider used to provide processes and their spawn/kill globally
- Changed hardcoded applications logic in Desktop to more maintainable generic processes
- Changed mouse and touch events in Window to generic pointer events
- Added reusable Button component
- Extended TextReader to split the raw text into tokens for better link formatting
- Updated window resizing so windows resize perfectly into available space
- Visual overhaul to match retro windows style more accuretly with perfect borders
- Updated LINKS with my Upwork profile link
- Added CREDITS with legal info and acknowledgments
- Updated Svelte to ^5.40

Version 0.1.3 - 28/11/2025

- Added touch support for dragging windows.
- Size of the Window is now bindable.
- Added maximize/minimize functionality to Window component.
- Added better mobile support for Windows - client width less than 600px now forces windows into maximized state.
- Changed font to monoscape for better retro aesthetic.
- PixelCanvas framebuffer is now recreated when its width or height changes.
- Added custom scrollbar component for TextReader application.
- Added external Voxelly application as a new desktop icon.
- Added start bar to the Desktop with start button and system tray with clock.
- Converted Desktop to not be a Window itself.
- Updated close button icon.
- Updated .txt extension icon.
- Added new site favicon.
- Removed overscroll behavior.

Version 0.1.2 - 19/11/2025

- Added Browser application that opens an in-app iframe to browse external websites.
- Added Match Mayhem (my Fiverr client project) browser-type application as a new desktop icon.
- Smoothed out Snow Simulator vortex animation, added ambient music and vortex sound effect.
- Desktop icons are now positioned in a cell layout.
- Removed links from ABOUT ME document.

Version 0.1.1 - 18/11/2025

- Added Snow Simulator application as a new desktop icon.
- Added Snow Simulator application that simulates falling snow with suction vortex effect.
- Removed /snow path as the snow simulation is now integrated into the desktop.
- Added PixelCanvas component used in Snow Simulator for pixel-based rendering.
- Removed drop-shadow from DesktopIcon component (shadow baked into icon images instead).
- Added mouse and keyboard callbacks to Window component.
- Improved Window focus management.
- Updated LINKS.txt with correct github repository link.
- Updated repo README with Snow Simulator screenshot.

Version 0.1.0 - 18/11/2025

Initial release of yOS.
- Added basic window management system with draggable windows.
- Implemented desktop icons with click functionality.
- Added audio feedback for desktop icon interactions.
- Created README, ABOUT ME, LINKS and CHANGELOG files for documentation.
- Old snow simulation WIP playground moved under /snow path.`;

function create_desktop_txt_file(kernel: Kernel, name: string, content: string) {
    const binaryWriter = new BinaryWriter(4 + content.length * 4);
    const fd = kernel.vfs.open(`/home/y3v4d/desktop/${name}.txt`);

    console.log(`Creating desktop file: /home/y3v4d/desktop/${name}.txt`);
    console.log(content.length);

    binaryWriter.uint32(content.length);
    binaryWriter.string(content);

    kernel.vfs.write(fd, binaryWriter.getBuffer());
}

function init_files(kernel: Kernel) {
    kernel.vfs.mkdir("/home/y3v4d/desktop");

    create_desktop_txt_file(kernel, "readme", readmeContent);
    
    create_desktop_txt_file(kernel, "about_me", aboutMeContent);
    create_desktop_txt_file(kernel, "about_this", aboutThisContent);

    create_desktop_txt_file(kernel, "links", linksContent);
    create_desktop_txt_file(kernel, "changelog", changelogContent);
    create_desktop_txt_file(kernel, "credits", creditsContent);
}

export { init_files };