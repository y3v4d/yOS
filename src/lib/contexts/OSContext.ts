import { createContext, type Component } from "svelte";

export type Executable<T extends Record<string, any> = any> = {
    component: Component<T>;
    params?: T;
}

export type Process = {
    id: number;
    executable: Executable;
}

export interface OSContext {
    spawnExecutable: <T extends Record<string, any> = any>(executable: Executable<T>) => Process;
    killProcess: (id: number) => void;
    getProcesses: () => Process[];
}

export const [getOSContext, setOSContext] = createContext<OSContext>();

