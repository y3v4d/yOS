yOS - Web Operating System v0.4.2
--------------------------------------------------

Welcome to yOS, an experimental Unix-like operating system running entirely in the browser.
Built around a lean kernel with Unix domain sockets, a persistent virtual filesystem, and an
X11-inspired display server — with all higher-level functionality implemented as separate
userspace applications, mirroring how a real Unix system is structured.

Desktop:
- The desktop serves as the main workspace where you can find icons representing applications and files.
- Double-click on an icon to open the corresponding application or file.
- Desktop icons can be repositioned by dragging them around the desktop.

Display Server:
- yOS uses Y11, an X11-inspired display server for managing windows and rendering the graphical interface.
- The display server runs as a userspace application and communicates with clients over Unix domain sockets.
- The window manager intercepts window creation requests via SubstructureRedirect, exactly as a real X11 window manager does.

Window Management:
- yWM is a fully featured window manager built on top of Y11 with a Windows 2000-inspired visual style.
- Windows can be moved, resized, minimized, maximized and closed.
- Click and drag the title bar to move a window around the desktop.
- Minimize windows to the taskbar and restore them by clicking their taskbar button.

Taskbar:
- The taskbar at the bottom provides quick access to open applications and system functions.
- Click on an application in the taskbar to bring its window to the foreground.
- The system tray displays the current time.

File System:
- yOS features a persistent virtual filesystem backed by IndexedDB, so your files survive page reloads.
- The filesystem is inode and block based, mirroring the structure of a real Unix filesystem.
- Use yNotepad to edit text files stored on the filesystem.

Applications:
- yNotepad — text file viewer and editor
- yTaskManager — view and manage running processes
- yBrowser — in-app browser for external websites
- Demo applications showcasing Svelte and Vue contexts
- Some of my personal or past client projects

Getting Help:
- Explore the other files on the desktop for additional details about yOS, its development and credits.

Enjoy exploring yOS!