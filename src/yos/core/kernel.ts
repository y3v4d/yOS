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
    private _vfs: VFS = null!;
    private _audio: AudioCore = null!;
    private _registry: Registry = new Registry();
    
    private _processes: Map<number, Process> = new Map();
    private _subscribers: Set<KernelEventQueue> = new Set();
    private _sockets: Map<number, Socket> = new Map();

    private _processSockets: Map<number, Set<Socket>> = new Map();
    private _processImports: Map<number, Map<string, any>> = new Map();

    private _nextPid: number = 0;
    private _nextSocketId: number = 0;

    private _currentProcess: Process | null = null;

    private constructor() {}

    static async create(version: number = 1) {
        const kernel = new Kernel();

        kernel._vfs = await VFS.create(kernel, version);
        kernel._audio = new AudioCore(kernel);
        kernel._registry = new Registry();

        // @ts-ignore
        window.yos = kernel;
        return kernel;
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

    async waitFor(type: string) {
        const subscriber = this.subscribe();
        while(true) {
            const event = subscriber.next();
            if(event && event.type === type) {
                this.unsubscribe(subscriber);
                return event;
            }

            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    async dlopen(name: string) {
        const currentProcess = this._currentProcess;
        if(!currentProcess) {
            throw new Error("Kernel: dlopen() called outside of a process context.");
        }

        if(!this._processImports.has(currentProcess.pid)) {
            this._processImports.set(currentProcess.pid, new Map());
        }

        const imports = this._processImports.get(currentProcess.pid)!;
        if(imports.has(name)) {
            return imports.get(name);
        }

        const lib = (await this._loadLib(name))(this);
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

    async bind(socket: Socket, address: string) {
        if(socket.state !== "UNBOUND") {
            throw new Error(`Socket ${socket.id} is not in UNBOUND state.`);
        }

        const socketPath = "/tmp/sockets/" + address;
        
        console.log(`Binding socket ${socket.id} to address ${address} at path ${socketPath}`);
        const fd = await this.vfs.open(socketPath);

        const data = new Uint8Array(4);
        const view = new DataView(data.buffer);
        view.setUint32(0, socket.id, true);

        await this.vfs.write(fd, data);

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

    async connect(socket: Socket, address: string) {
        if(socket.state !== "UNBOUND") {
            throw new Error(`Socket ${socket.id} is not in UNBOUND state.`);
        }

        const socketPath = "/tmp/sockets/" + address;
        const fd = await this.vfs.open(socketPath);

        const data = await this.vfs.read(fd, 4);
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

    async close(socket: Socket) {
        if(socket.state === "CLOSED") {
            throw new Error(`Socket ${socket.id} is already closed.`);
        }

        console.log(`Closing socket ${socket.id} with state ${socket.state}.`);

        if(socket.state === "LISTENING" || socket.state === "BOUND") {
            const socketPath = "/tmp/sockets/" + socket.path!;
            await this.vfs.unlink(socketPath);
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

    async execve(path: string, ...args: any[]) {
        const fd = await this.vfs.open(path);

        await this.vfs.fseek(fd, 0, "END");
        const fileSize = fd.position;
        await this.vfs.fseek(fd, 0, "SET");

        const data = await this.vfs.read(fd, fileSize);
        const view = new DataView(data.buffer);

        const codeLength = view.getUint32(0, true);
        const code = new TextDecoder().decode(data.subarray(4, 4 + codeLength));

        const process = await this.exec(code, ...args);
        process.path = path;

        return process;
    }

    async exec(code: string, ...args: any[]) {
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

        const libMap = new Map<string, any>();

        // search for needed imports that have format include("libname")
        const importRegex = /include\("([^"]+)"\)/g;
        let match: RegExpExecArray | null;
        while((match = importRegex.exec(code)) !== null) {
            const [fullMatch, libName] = match;
            if(libMap.has(libName)) {
                continue;
            }
            
            console.log(`Kernel: Found import "${libName}" in process ${pid}. Attempting to load...`);

            const lib = (await this._loadLib(libName))(proxyKernel);
            libMap.set(libName, lib);
        }

        const fn = new Function("kernel", "include", `
            ${code} 
            return main;
        `)(proxyKernel, (libName: string) => {
            if(!libMap.has(libName)) {
                throw new Error(`Kernel: Process ${pid} attempted to load unknown library "${libName}".`);
            }
            return libMap.get(libName);
        });

        this._processes.set(pid, process);
        this._emit({ type: "process:spawned", pid });

        console.log(`Kernel: Launching process ${pid}.`);
        fn(args).catch((error: any) => console.error(error)).finally(() => {
            const processSockets = this._processSockets.get(pid);
            console.log(`Kernel: Process ${pid} is exiting. Closing ${processSockets ? processSockets.size : 0} associated sockets.`);
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
            console.log(`Kernel: Marked process ${pid} for termination. Active sockets: ${this._processSockets.get(pid)?.size ?? 0}`);
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

    private async _loadLib(libName: string) {
        const fd = await this.vfs.open(`/libs/${libName}.lib`);
        await this.vfs.fseek(fd, 0, "END");
        const fileSize = fd.position;
        await this.vfs.fseek(fd, 0, "SET");

        const data = await this.vfs.read(fd, fileSize);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        const contentLength = view.getUint32(0, true);
        const code = new TextDecoder().decode(data.subarray(4, 4 + contentLength));

        const lib = new Function("kernel", `${code} return main;`);
        return lib;
    }

    private _emit(event: KernelEvent) {
        for(const queue of this._subscribers) {
            queue.push(event);
        }
    }
}

export type { Process, KernelEvent };
export { Kernel, KernelEventQueue };