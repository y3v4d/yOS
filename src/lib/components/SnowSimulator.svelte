<script lang="ts">
    import PixelCanvas from "./core/PixelCanvas.svelte";
    import Window, { type WindowProps } from "./core/Window.svelte";

    import img_snow_png from "$lib/assets/icons/img_snow_simulator.png";
    import img_vortex from "$lib/assets/vortex.png";
    import { onMount } from "svelte";

    interface SnowSimulatorProps extends Partial<WindowProps> {}

    let {
        ...rest
    }: SnowSimulatorProps = $props();

    let x = $state(150);
    let y = $state(150);
    let helpVisible = $state(true);

    const width = 640;
    const height = 480;
    const framebufferWidth = 160;
    const framebufferHeight = 120;

    const snowPalette = [
        "#ffffff", // Pure White
        "#d9f0ff", // Ice Blue
        "#bce0ee", // Pale Cyan
        "#a3b7c2", // Frost Gray
        "#6a8ca2", // Blue Shadow
        "#d6d2e8", // Cold Lavender
        "#c0c0c0"  // Snow Gray
    ];

    const snowWeights = [20, 25, 15, 15, 10, 8, 7];

    let map: number[] = Array(framebufferWidth * framebufferHeight).fill(0);

    let pixelCanvas: PixelCanvas;
    let fps = $state(0);
    let hole: {
        x: number;
        y: number;
        r: number;
    } | null = null;

    let vortexImage: HTMLImageElement;
    let vortexFrames: ImageData[] = [];
    let vortexFrameIndex = 0;

    onMount(() => {
        vortexImage = new Image();
        vortexImage.src = img_vortex;
        vortexImage.onload = () => {
            const frames = 8;

            for(let i = 0; i < frames; i++) {
                const angle = (i / frames) * 2 * Math.PI;
                const frameData = createRotatedImageData(vortexImage, angle);

                vortexFrames.push(frameData);
            }
        };

        const interval = 1000 / 60;
        let animationFrameId: number;
        let lastTimestamp = -1;

        let intervalAccumulator = 0;
        let vortexAccumulator = 0;

        let frameAccumulator = 0;
        let frameCount = 0;

        const loop = (timestamp: number) => {
            const delta = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            intervalAccumulator += delta;
            frameAccumulator += delta;
            vortexAccumulator += delta;

            if(vortexAccumulator >= 100) {
                vortexAccumulator -= 100;
                vortexFrameIndex = (vortexFrameIndex + 1) % vortexFrames.length;
            }

            while(intervalAccumulator >= interval) {
                intervalAccumulator -= interval;

                frameCount++;
                if (frameAccumulator >= 1000) {
                    fps = frameCount;
                    frameCount = 0;
                    frameAccumulator = 0;
                }

                update();
                pixelCanvas.render();
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        pixelCanvas.clear(0, 0, 0);
        animationFrameId = requestAnimationFrame(() => {
            lastTimestamp = performance.now();
            loop(lastTimestamp);
        });

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    });

    function update() {
        pixelCanvas.clear(0, 0, 0, 255);

        if(hole) {
            const { x, y, r } = hole;
            for(let i = -r; i <= r; i++) {
                for(let j = -r; j <= r; j++) {
                    if(i * i + j * j > r * r) {
                        continue;
                    }

                    const px = x + i;
                    const py = y + j;

                    if(px < 0 || px >= framebufferWidth) {
                        continue;
                    }

                    if(py < 0 || py >= framebufferHeight) {
                        continue;
                    }

                    //pixelCanvas.setPixel(px, py, 0, 0, 0, 255);
                    set_map(px, py, 0);
                }
            }
        }

        for(let y = framebufferHeight - 1; y >= 0; y--) {
            for(let x = 0; x < framebufferWidth; x++) {
                if(!is_occupied(x, y)) {
                    continue;
                }

                const free_bottom = y < framebufferHeight - 1 && !is_occupied(x, y + 1);
                if(free_bottom) {
                    //pixelCanvas.swapPixels(x, y, x, y + 1);
                    swap_map(x, y, x, y + 1);
                }
            }

            for(let x = 0; x < framebufferWidth; x++) {
                if(!is_occupied(x, y)) {
                    continue;
                }

                const free_bottom_left = x > 0 && !is_occupied(x - 1, y + 1);
                const free_bottom_right = x < framebufferWidth - 1 && !is_occupied(x + 1, y + 1);

                if(free_bottom_left && free_bottom_right) {
                    if(Math.random() < 0.5) {
                        //pixelCanvas.swapPixels(x, y, x - 1, y + 1);
                        swap_map(x, y, x - 1, y + 1);
                    } else {
                        //pixelCanvas.swapPixels(x, y, x + 1, y + 1);
                        swap_map(x, y, x + 1, y + 1);
                    }
                } else if(free_bottom_left) {
                    //pixelCanvas.swapPixels(x, y, x - 1, y + 1);
                    swap_map(x, y, x - 1, y + 1);
                } else if(free_bottom_right) {
                    //pixelCanvas.swapPixels(x, y, x + 1, y + 1);
                    swap_map(x, y, x + 1, y + 1);
                }
            }
        }

        let amount = Math.max(1, Math.floor(framebufferWidth / 50));
        for(let i = 0; i < amount; ++i) {
            const x = Math.floor(Math.random() * framebufferWidth);
            const y = 0;

            if(!is_occupied(x, y)) {
                const colorId = pickColorId(snowPalette, snowWeights);
                set_map(x, y, colorId);
            }
        }

        const data = pixelCanvas.getBufferData();
        if(hole) {
            const frame = vortexFrames[vortexFrameIndex];

            const x = Math.floor(hole.x - frame.width / 2);
            const y = Math.floor(hole.y - frame.height / 2);

            pixelCanvas.putImage(x, y, frame);
        }

        for(let x = 0; x < framebufferWidth; x++) {
            for(let y = 0; y < framebufferHeight; y++) {
                const index = y * framebufferWidth + x;
                const type = map[index];
                if(type == 0) {
                    continue;
                }

                const [r, g, b] = hexToRgb(snowPalette[type]);

                data[index * 4 + 0] = r;
                data[index * 4 + 1] = g;
                data[index * 4 + 2] = b;
            }
        }
    }

    function onWindowMouseDown(mouseX: number, mouseY: number) {
        const [x, y] = windowToFrambuffer(mouseX, mouseY);
        const radius = 4;

        hole = { x, y, r: radius };
        console.log(hole);
    }

    function onWindowMouseMove(mouseX: number, mouseY: number) {
        if(!hole) {
            return;
        }

        const [x, y] = windowToFrambuffer(mouseX, mouseY);

        hole.x = x;
        hole.y = y;
    }

    function onWindowMouseUp(x: number, y: number) {
        hole = null;
    }

    function onKeyDown(key: string) {
        if(key === 'h' || key === 'H') {
            helpVisible = !helpVisible;
        }
    }

    function windowToFrambuffer(x: number, y: number) {
        const framebufferX = Math.floor((x / width) * framebufferWidth);
        const framebufferY = Math.floor((y / height) * framebufferHeight);

        return [framebufferX, framebufferY];
    }

    function createRotatedImageData(original: HTMLImageElement, angle: number) {
        const canvas = document.createElement('canvas');
        canvas.width = original.width;
        canvas.height = original.height;

        const ctx = canvas.getContext('2d');
        if(!ctx) {
            throw new Error("Failed to get canvas context");
        }

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(angle);
        ctx.drawImage(original, -original.width / 2, -original.height / 2);
        ctx.restore();

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function set_map(x: number, y: number, type: number) {
        const index = y * framebufferWidth + x;
        map[index] = type;
    }

    function swap_map(x0: number, y0: number, x1: number, y1: number) {
        const index0 = y0 * framebufferWidth + x0;
        const index1 = y1 * framebufferWidth + x1;

        const temp = map[index0];
        map[index0] = map[index1];
        map[index1] = temp;
    }

    function is_occupied(x: number, y: number): boolean {
        const index = (y * framebufferWidth + x);
        if(index < 0 || index >= framebufferWidth * framebufferHeight) {
            return true;
        }

        return map[index] != 0;
    }

    function pickColorId(palette: string[], weights: number[]): number {
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for(let i = 0; i < palette.length; i++) {
            if(random < weights[i]) {
                return i;
            }

            random -= weights[i];

        }

        return 0;
    }

    function hexToRgb(hex: string): [number, number, number] {
        const bigint = parseInt(hex.slice(1), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;

        return [r, g, b];
    }
</script>

<Window 
    {...rest}

    bind:x={x} bind:y={y} 
    width={width} height={height} 
    title="Snow Simulator - FPS {fps}" 
    icon={img_snow_png}
    mouseDown={onWindowMouseDown}
    mouseMove={onWindowMouseMove}
    mouseUp={onWindowMouseUp}
    keyDown={onKeyDown}
>
    <PixelCanvas bind:this={pixelCanvas} width={width} height={height} framebufferWidth={framebufferWidth} framebufferHeight={framebufferHeight} />
    {#if helpVisible}
        <div 
            class="absolute left-0 top-0 bg-black p-2 text-white leading-4 flex flex-col"
        >
            <p>Controls</p>
            <p>LMB - Create Hole</p>
            <p>H - Toggle Help</p>
        </div>
    {/if}
</Window>