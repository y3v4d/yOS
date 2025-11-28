<script lang="ts">
    import { onMount, tick } from "svelte";

    interface Props {
        width: number;
        height: number;
        framebufferWidth?: number;
        framebufferHeight?: number;
    }

    let { 
        width, 
        height,
        framebufferWidth = width,
        framebufferHeight = height
    }: Props = $props();

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let buffer: ImageData;

    onMount(() => {
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to get 2D context");
        }

        ctx = context;
        buffer = ctx.createImageData(framebufferWidth, framebufferHeight);
    });

    $effect(() => {
        framebufferWidth;
        framebufferHeight;

        tick().then(() => {
            buffer = ctx.createImageData(framebufferWidth, framebufferHeight);
        });
    })

    export function clear(r: number, g: number, b: number, a: number = 255) {
        for(let i = 0; i < buffer.data.length; i += 4) {
            buffer.data[i] = r;
            buffer.data[i + 1] = g;
            buffer.data[i + 2] = b;
            buffer.data[i + 3] = a;
        }
    }

    export function setPixel(x: number, y: number, r: number, g: number, b: number, a: number = 255) {
        const index = (y * framebufferWidth + x) * 4;

        buffer.data[index] = r;
        buffer.data[index + 1] = g;
        buffer.data[index + 2] = b;
        buffer.data[index + 3] = a;
    }

    export function putImage(x: number, y: number, data: ImageData) {
        for(let j = 0; j < data.height; j++) {
            for(let i = 0; i < data.width; i++) {
                const srcIndex = (j * data.width + i) * 4;
                const dstIndex = ((y + j) * framebufferWidth + (x + i)) * 4;

                if(data.data[srcIndex + 3] < 255) {
                    continue;
                }

                buffer.data[dstIndex] = data.data[srcIndex];
                buffer.data[dstIndex + 1] = data.data[srcIndex + 1];
                buffer.data[dstIndex + 2] = data.data[srcIndex + 2];
                buffer.data[dstIndex + 3] = data.data[srcIndex + 3];
            }
        }
    }

    export function putHTMLImage(x: number, y: number, data: HTMLImageElement) {
        ctx.drawImage(data, x, y);
    }

    export function getPixel(x: number, y: number): [number, number, number, number] {
        const index = (y * framebufferWidth + x) * 4;

        return [
            buffer.data[index],
            buffer.data[index + 1],
            buffer.data[index + 2],
            buffer.data[index + 3]
        ];
    }

    export function swapPixels(x0: number, y0: number, x1: number, y1: number) {
        const index0 = (y0 * framebufferWidth + x0) * 4;
        const index1 = (y1 * framebufferWidth + x1) * 4;

        for(let i = 0; i < 4; i++) {
            const temp = buffer.data[index0 + i];
            buffer.data[index0 + i] = buffer.data[index1 + i];
            buffer.data[index1 + i] = temp;
        }
    }
    
    export function getBufferData(): Uint8ClampedArray {
        return buffer.data;
    }

    export function render() {
        ctx.putImageData(buffer, 0, 0);
    }
</script>

<canvas bind:this={canvas} width={framebufferWidth} height={framebufferHeight} style="width: {width}px; height: {height}px; image-rendering: pixelated;"></canvas>