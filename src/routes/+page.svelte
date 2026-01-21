<script lang="ts">
    import Desktop from "$lib/components/Desktop.svelte";
    import OSContextProvider from "$lib/contexts/OSContextProvider.svelte";
</script>

<main class="relative h-full w-full overflow-hidden bg-black">
    <OSContextProvider>
        <Desktop />
    </OSContextProvider>
</main>