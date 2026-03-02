import { EventQueue } from "../utils/event-queue";
import PathUtils from "../utils/path-utils";
import { VfsFormtUtils } from "../utils/vfs-utils";
import { AudioCore } from "./audio";
import { VFS } from "./vfs";

class Executable {
    constructor(readonly kernel: Kernel) {}

    onInit(): void {}
    onTick(): boolean { return false; }
    onDestroy(): void {}

    getExecutableName(): string {
        return "Unnamed Executable";
    }
}

abstract class Library {
    constructor(readonly kernel: Kernel) {}

    abstract getName(): string;
}

class Registry {
    private _entries: Map<string, any> = new Map();

    set<T>(name: string, entry: T) {
        this._entries.set(name, entry);
    }

    get<T>(name: string): T | null {
        return this._entries.get(name) as T || null;
    }

    delete(name: string) {
        this._entries.delete(name);
    }
}

interface ProcessContext<T> {
    pid: number;
    data: T;
}

interface Process<T = unknown> {
    pid: number;
    executable: Executable;

    path?: string;
}

type KernelEvent = 
    { type: "process:spawned"; pid: number; } |
    { type: "process:killed"; pid: number; } |
    { type: "file:created"; path: string; } |
    { type: "file:deleted"; path: string; } |
    { type: "file:modified"; path: string; };

class KernelEventQueue extends EventQueue<KernelEvent> {}

class Kernel {
    private _vfs: VFS;
    private _audio: AudioCore;
    private _registry: Registry = new Registry();
    
    private _processes: Map<number, Process> = new Map();
    private _subscribers: Set<KernelEventQueue> = new Set();
    private _executablesRegistry: Map<string, new (kernel: Kernel, ...args: any[]) => Executable> = new Map();
    private _libraries: Map<string, Library> = new Map();
    private _nextPid: number = 0;

    constructor() {
        this._vfs = new VFS(this);
        this._audio = new AudioCore(this);
        this._registry = new Registry();

        // @ts-ignore
        window.yos = this;
    }

    subscribe() {
        const queue = new KernelEventQueue();
        this._subscribers.add(queue);

        return queue;
    }

    unsubscribe(subscriber: KernelEventQueue) {
        this._subscribers.delete(subscriber);
    }

    emit(event: KernelEvent) {
        for(const subscriber of this._subscribers) {
            subscriber.push(event);
        }
    }

    registerLibrary(library: Library) {
        this._libraries.set(library.getName(), library);
    }

    import<T extends Library>(name: string): T | null {
        return this._libraries.get(name) as T || null;
    }

    spawnProcess<T extends any[]>(runner: new (kernel: Kernel, ...args: T) => Executable, path?: string, ...args: T): Process {
        const pid = this._nextPid++;
        const process: Process = {
            pid,
            executable: new runner(this, ...args),
            path,
        };

        console.log(`Kernel: Spawning process with PID ${pid} and path "${path}"`);
        console.log(args);

        this._processes.set(pid, process);
        this._emit({ type: "process:spawned", pid });

        process.executable.onInit();
        console.log(`Kernel: Spawned process with PID ${pid}`);

        return process;
    }

    execve(path: string, ...args: any[]) {
        console.log(`Kernel: execve called with path "${path}" and args:`, args);

        const inode = this.vfs.stat(path);
        if(inode.type === 1) {
            console.warn("Directory execution not available yet.");
            return;
        }

        const ext = PathUtils.extname(path).slice(1);
        let app: typeof Executable | null = null;
        let executableProps: any = {};
        
        if(ext === "exe") {
            const formatUtils = new VfsFormtUtils(this.vfs);

            const { executable, props } = formatUtils.readExecutable(path);
            
            app = this.registry.get<typeof Executable>(executable);
            executableProps = props;
        } else {
            const appName = this.registry.get<string>("ext-" + ext + "-application");
            if(!appName) {
                console.warn("No application associated with extension:", ext);
                return;
            }

            app = this.registry.get<typeof Executable>(appName);
        }

        if(!app) {
            console.error("Application not found for path:", path);
            return;
        }

        this.spawnProcess<any>(app, path, args[0] ? { ...executableProps, ...args[0] } : executableProps);
    }

    killProcess(pid: number) {
        const process = this._processes.get(pid);
        if (process) {
            process.executable.onDestroy();
            this._processes.delete(pid);
            
            this._emit({ type: "process:killed", pid });
            console.log(`Kernel: Killed process with PID ${pid}`);
        }
    }

    getProcess(pid: number) {
        return this._processes.get(pid) || null;
    }

    listProcesses() {
        return Array.from(this._processes.values());
    }

    tick() {
        for(const process of this._processes.values()) {
            if(process.executable.onTick()) {
                this.killProcess(process.pid);
            }
        }
    }

    get registry() {
        return this._registry;
    }

    get audio() {
        return this._audio;
    }

    get vfs() {
        return this._vfs;
    }

    private _emit(event: KernelEvent) {
        for(const queue of this._subscribers) {
            queue.push(event);
        }
    }
}

export { Executable };
export { Library };
export type { Process, KernelEvent };
export { Kernel, KernelEventQueue };