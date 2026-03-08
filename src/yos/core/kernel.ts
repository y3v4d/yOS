import { EventQueue } from "../utils/event-queue";
import { AudioCore } from "./audio";
import { VFS } from "./vfs";

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

interface Process {
    pid: number;
    executable: any;

    should_kill?: boolean;
    is_dead?: boolean;
    resume?: () => void;
    path?: string;
}

type KernelEvent = 
    { type: "process:spawned"; pid: number; } |
    { type: "process:killed"; pid: number; } |
    { type: "file:created"; path: string; } |
    { type: "file:deleted"; path: string; } |
    { type: "file:modified"; path: string; };

class KernelEventQueue extends EventQueue<KernelEvent> {}

export interface Socket {
    id: number;
    state: "UNBOUND" | "BOUND" | "LISTENING" | "CONNECTED" | "DISCONNECTED" | "CLOSED";

    pid: number;

    path: string | null;
    peer: Socket | null;

    acceptWaiters: ((socket: Socket) => void)[];
    recvWaiters: ((data: Uint8Array | null) => void)[];
    pendingQueue: Socket[];

    buffer: (Uint8Array | null)[];
}

class Kernel {
    private _vfs: VFS;
    private _audio: AudioCore;
    private _registry: Registry = new Registry();
    
    private _processes: Map<number, Process> = new Map();
    private _subscribers: Set<KernelEventQueue> = new Set();
    private _sockets: Map<number, Socket> = new Map();

    private _processSockets: Map<number, Set<Socket>> = new Map();
    private _processImports: Map<number, Map<string, any>> = new Map();

    private _nextPid: number = 0;
    private _nextSocketId: number = 0;

    private _currentProcess: Process | null = null;

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

    import(name: string) {
        if(!this._currentProcess) {
            throw new Error("Kernel: import() called outside of a process context.");
        }

        if(!this._processImports.has(this._currentProcess.pid)) {
            this._processImports.set(this._currentProcess.pid, new Map());
        }

        const imports = this._processImports.get(this._currentProcess.pid)!;
        if(imports.has(name)) {
            return imports.get(name);
        }

        const fd = this.vfs.open(`/libs/${name}.lib`);
        this.vfs.fseek(fd, 0, "END");
        const fileSize = fd.position;
        this.vfs.fseek(fd, 0, "SET");

        const data = this.vfs.read(fd, fileSize);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        const contentLength = view.getUint32(0, true);
        const content = new TextDecoder().decode(data.subarray(4, 4 + contentLength));

        console.log(`Kernel: Importing library "${name}" for process ${this._currentProcess.pid}...`);
        const lib = new Function("kernel", `${content} return main;`)(this);
        imports.set(name, lib);

        return lib;
    }

    socket() {
        const pid = this.getpid();
        if(pid === null) {
            throw new Error("Kernel: Cannot create socket outside of a process context.");
        }

        const socket: Socket = {
            id: this._nextSocketId++,
            state: "UNBOUND",

            pid: pid,

            path: null,
            peer: null,

            acceptWaiters: [],
            recvWaiters: [],
            pendingQueue: [],

            buffer: [],
        };

        this._sockets.set(socket.id, socket);
        if(!this._processSockets.has(socket.pid)) {
            this._processSockets.set(socket.pid, new Set());
        }
        this._processSockets.get(socket.pid)!.add(socket);

        return socket;
    }

    bind(socket: Socket, address: string) {
        if(socket.state !== "UNBOUND") {
            throw new Error(`Socket ${socket.id} is not in UNBOUND state.`);
        }

        const socketPath = "/tmp/sockets/" + address;

        this.vfs.mkdir("/tmp/sockets", true);
        const fd = this.vfs.open(socketPath);

        const data = new Uint8Array(4);
        const view = new DataView(data.buffer);
        view.setUint32(0, socket.id, true);

        this.vfs.write(fd, data);

        socket.path = address;
        socket.state = "BOUND";
    }

    listen(socket: Socket) {
        if(socket.state !== "BOUND") {
            throw new Error(`Socket ${socket.id} is not in BOUND state.`);
        }

        socket.state = "LISTENING";
    }

    send(socket: Socket, data: Uint8Array) {
        if(socket.state !== "CONNECTED") {
            console.log('was about to send');
            console.log(new TextDecoder().decode(data));
            throw new Error(`Socket ${socket.id} is not in CONNECTED state.`);
        }

        const peer = socket.peer!;

        if(peer.recvWaiters.length > 0) {
            const resolve = peer.recvWaiters.shift()!;
            resolve(data);
        } else {
            peer.buffer.push(data);
        }
    }

    async readv(socket: Socket) {
        if(socket.state !== "CONNECTED") {
            return null;
        }

        if(socket.buffer.length > 0) {
            return socket.buffer.shift()!;
        }

        return new Promise<Uint8Array | null>((resolve) => {
            socket.recvWaiters.push(resolve);
        });
    }

    async accept(socket: Socket) {
        if(socket.state !== "LISTENING") {
            throw new Error(`Socket ${socket.id} is not in LISTENING state.`);
        }

        if(socket.pendingQueue.length > 0) {
            return socket.pendingQueue.shift()!;
        }

        return new Promise<Socket>((resolve) => {
            socket.acceptWaiters.push(resolve);
        });
    }

    connect(socket: Socket, address: string) {
        if(socket.state !== "UNBOUND") {
            throw new Error(`Socket ${socket.id} is not in UNBOUND state.`);
        }

        const socketPath = "/tmp/sockets/" + address;
        const fd = this.vfs.open(socketPath);

        const data = this.vfs.read(fd, 4);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const socketId = view.getUint32(0, true);

        const serverSocket = this._sockets.get(socketId);
        if(!serverSocket) {
            throw new Error(`No server socket found with id ${socketId} for address ${address}.`);
        }

        if(serverSocket.state !== "LISTENING") {
            throw new Error(`Server socket ${serverSocket.id} is not in LISTENING state.`);
        }

        const connSocket: Socket = {
            id: this._nextSocketId++,
            state: "CONNECTED",

            pid: socket.pid,

            path: address,
            peer: socket,

            acceptWaiters: [],
            recvWaiters: [],
            pendingQueue: [],

            buffer: [],
        };

        socket.peer = connSocket;
        socket.state = "CONNECTED";

        if(serverSocket.acceptWaiters.length > 0) {
            const resolve = serverSocket.acceptWaiters.shift()!;
            resolve(connSocket);
        } else {
            serverSocket.pendingQueue.push(connSocket);
        }
    }

    close(socket: Socket) {
        if(socket.state === "CLOSED") {
            throw new Error(`Socket ${socket.id} is already closed.`);
        }

        if(socket.state === "LISTENING" || socket.state === "BOUND") {
            const socketPath = "/tmp/sockets/" + socket.path!;
            this.vfs.rm(socketPath);
        }

        if(socket.state === "CONNECTED") {
            const peer = socket.peer!;

            if(peer.recvWaiters.length > 0) {
                const resolve = peer.recvWaiters.shift()!;
                resolve(null);
            }

            peer.peer = null;
            peer.state = "DISCONNECTED";
            socket.peer = null;
        }

        socket.state = "CLOSED";
        this._sockets.delete(socket.id);
        
        const processSockets = this._processSockets.get(socket.pid);
        if(processSockets) {
            processSockets.delete(socket);
            if(processSockets.size === 0) {
                this._processSockets.delete(socket.pid);
            }
        }
    }

    execve(path: string, ...args: any[]) {
        const fd = this.vfs.open(path);

        this.vfs.fseek(fd, 0, "END");
        const fileSize = fd.position;
        this.vfs.fseek(fd, 0, "SET");

        const data = this.vfs.read(fd, fileSize);
        const view = new DataView(data.buffer);

        const codeLength = view.getUint32(0, true);
        const code = new TextDecoder().decode(data.subarray(4, 4 + codeLength));

        const process = this.exec(code, ...args);
        process.path = path;

        console.log(`Kernel: Assigned process ${process.pid} to path "${path}".`);

        return process;
    }

    exec(code: string, ...args: any[]) {
        const pid = this._nextPid++;
        const process: Process = {
            pid,
            executable: null!,
        };

        const realKernel = (this as any).__target ?? this;
        const proxyKernel = new Proxy(realKernel, {
            get: (target, prop) => {
                if(prop === "__target") return this;

                const orig = (target as any)[prop];
                if (typeof orig !== "function") return orig;

                return (...args: any[]) => {
                    this._currentProcess = process;

                    try {
                        return orig.apply(proxyKernel, args);
                    } finally {
                        this._currentProcess = null;
                    }
                };
            }
        });

        const fn = new Function("kernel", `
            ${code} 
            return main;
        `)(proxyKernel);

        this._processes.set(pid, process);
        this._emit({ type: "process:spawned", pid });

        console.log(`Kernel: Launching process ${pid}.`);
        fn(args).catch((error: any) => console.error(error)).finally(() => {
            const processSockets = this._processSockets.get(pid);
            if(processSockets) {
                for(const socket of processSockets) {
                    this.close(socket);
                }
            }

            process.is_dead = true;

            this._processSockets.delete(pid);
            this._processImports.delete(pid);

            this._processes.delete(pid);
            this._emit({ type: "process:killed", pid });

            console.log(`Kernel: Process ${pid} completed execution.`);
        });

        return process;
    }

    killProcess(pid: number) {
        const process = this._processes.get(pid);
        if (process) {
            process.should_kill = true;
            console.log(`Kernel: Marked process ${pid} for termination.`);
        } else {
            console.warn(`Kernel: Attempted to kill non-existent process with PID ${pid}.`);
        }
    }

    listProcesses() {
        return Array.from(this._processes.values());
    }

    async yield() {
        const process = this._currentProcess;
        if(!process) {
            console.warn("Kernel: No process is currently running to yield.");
            return;
        }

        return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                if(process.should_kill) {
                    reject(new Error(`Process ${process.pid} was killed during yield.`));
                } else {
                    resolve();
                }
            }, 0);
        });
    }

    getpid() {
        if(!this._currentProcess) {
            throw new Error("Kernel: getpid() called outside of a process context.");
        }

        return this._currentProcess.pid;
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

export type { Process, KernelEvent };
export { Kernel, KernelEventQueue };