class EventEmitter<T extends Record<string, any[]> = {}> {
    private name: string;
    private listeners: { [K in keyof T]?: Array<(...args: T[K]) => void> } = {};

    constructor(name: string) {
        this.name = name;
    }

    on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]!.push(listener);
    }

    off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event]!.filter(l => l !== listener);
    }

    emit<K extends keyof T>(event: K, ...args: T[K]): void {
        if (!this.listeners[event]) return;

        //console.log(`${this.name}: Emitting event '${String(event)}' to ${this.listeners[event]!.length} listener(s).`);
        //console.log(args.length > 1 ? args : args[0]);

        for (const listener of this.listeners[event]!) {
            listener(...args);
        }
    }
}

export { EventEmitter };