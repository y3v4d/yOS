<script lang="ts">
    import Window, { type WindowProps } from "./core/Window.svelte";

    interface BrowserProps extends Partial<WindowProps> {
        url: string;
    }

    let {
        url = "https://example.com",
        ...windowProps
    }: BrowserProps = $props();
</script>

<Window 
    x={100} 
    y={100} 
    width={300} 
    height={600} 
    title={"Browser"}
    {...windowProps} 
>
    <iframe title={windowProps.title || "Browser"} src={url} class="w-full h-full border-0"></iframe>
</Window>