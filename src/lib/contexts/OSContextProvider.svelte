<script lang="ts">
    import { type Process, setOSContext, type OSContext, type Executable } from "./OSContext";

    interface OSContextProviderProps {
        children?: () => any;
    }

    let { children }: OSContextProviderProps = $props();

    let processes = $state<Process[]>([]);
    let nextProcessId = $state(1);

    function spawnExecutable(executable: Executable) {
        const process: Process = {
            id: nextProcessId,
            executable
        };

        processes = [...processes, process];
        nextProcessId += 1;

        return process;
    }

    function killProcess(id: number) {
        processes = processes.filter(p => p.id !== id);
    }

    function getProcesses(): Process[] {
        return processes;
    }

    setOSContext({
        spawnExecutable,
        killProcess,
        getProcesses
    } satisfies OSContext);
</script>

{@render children?.()}