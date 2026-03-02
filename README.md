# yOS - A portfolio website showcasing my projects, skills, and experiences as a developer.

## Overview

yOS is a architecturally unique portfolio website that mimics a desktop operating system environment. It allows visitors to interact with my projects and skills as if they were using a real desktop, providing an engaging and immersive experience. The core of yOS is framework-agnostic, built using TypeScript and designed to be easily adaptable to various frontend frameworks. The current implementation uses Svelte for most of the UI components, while the underlying window management and application execution logic is built in a framework-agnostic manner, allowing for attachement of different frontend frameworks through context system and X11-like display server.

*Project is still a very early work in progress and many features are yet to be implemented.*

## Features

- Framework-agnostic core architecture with TypeScript, allowing for easy integration of different frontend frameworks.
- Svelte 5 used for rendering applications and UI components, with a context system to allow for integration of other frameworks like Vue3.
- X11-inspired display server for managing windows and rendering the graphical interface.
- yWM window manager with draggable and resizable windows, built on top of the display server.
- yDesktop application serving as the main desktop environment with wallpaper and desktop icons.
- yTaskbar application serving as the taskbar with start menu, application list and system tray.
- yTaskManager application to view and manage running applications and processes.
- yNotepad application to view and edit text files from the virtual file system.
- Virtual file system (VFS) with basic file and directory operations.
- Audio core for managing audio playback and sound effects.
- Registry for storing and retrieving global entries like executables and applications.

## Technologies Used

- Svelte
- Vue3
- TypeScript
- Vite

## Live Demo

A live demo of yOS can be found at: [https://y3v4d.com](https://y3v4d.com)

## Image Gallery

![yOS Desktop](./docs/yos-desktop.png)
![yOS Multiple Contexts](./docs/yos-multiple-contexts.png)
![yOS Task Manager](./docs/yos-task-manager.png)
![yOS Multiple Windows](./docs/yos-multiple-windows.png)