<script lang="ts">
    import { onMount } from "svelte";
    import marioSrc from "$lib/assets/maze.png";

    let canvas: HTMLCanvasElement;
    let shouldSnow = $state(true);
    let skipFrames = $state(1);

    const desertPalette = [
        "#fff8dc", "#f2e4b2", "#d7c192", "#c9a55b", "#b07a28",
        "#c7c0af", "#7b5a24", "#a14a22", "#8a7b65", "#e4d7c5"
    ];

    const desertWeights = [20, 30, 15, 10, 5, 5, 5, 5, 3, 2];

    const oceanPalette = [
        "#004e89", "#0077be", "#00a6c6", "#6bd1e9", "#b3e5fc",
        "#005f6a", "#2ec4b6", "#e0f7fa", "#4a708b", "#f2e4b2"
    ];

    const oceanWeights = [20, 30, 15, 10, 5, 5, 5, 3, 3, 2];

    const firePalette = [
        "#7f1a00", "#d62828", "#f05424", "#f2a541",
        "#f7d060", "#fff3b0", "#ffffff", "#3a2e2e"
    ];

    const fireWeights = [10, 20, 25, 20, 15, 7, 2, 5];

    const grassPalette = [
        "#a6d854", "#7ac74f", "#4a7c2e", "#637a3c",
        "#c7e570", "#7d674e", "#5a7043", "#d0e3a4", "#e5f3b0"
    ];

    const grassWeights = [25, 30, 15, 10, 10, 5, 3, 1, 1];

    const stonePalette = [
        "#3b3f4f", // Dark Slate
        "#7a7d8f", // Medium Gray
        "#b0b3be", // Light Gray
        "#5a6470", // Cool Blue Gray
        "#867c75"  // Warm Taupe
    ];

    const stoneWeights = [15, 30, 25, 20, 10];

    const icePalette = [
        "#ffffff", // Pure White
        "#d9f0ff", // Light Ice Blue
        "#a8d0e6", // Soft Cyan
        "#7f8fa6", // Cool Gray
        "#3b4964"  // Deep Blue Shadow
    ];

    const iceWeights = [25, 30, 20, 15, 10];

    const magicPalette = [
        "#8e44ad", // Bright Purple
        "#2980b9", // Electric Blue
        "#e91e63", // Neon Pink
        "#27ae60", // Lime Green
        "#c39bd3"  // Soft Lavender
    ];

    const magicWeights = [20, 25, 20, 20, 15];

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

    function pickColor(palette: string[], weights: number[]) {
        let sum = weights.reduce((a,b) => a + b);
        let rnd = Math.random() * sum;

        for (let i=0; i < weights.length; i++) {
            if (rnd < weights[i]) {
                return palette[i];
            }

            rnd -= weights[i];
        }

        return palette[0];
    }

    function hexToRgb(hex: string): [number, number, number] {
        const bigint = parseInt(hex.slice(1), 16);
        return [
            (bigint >> 16) & 255,
            (bigint >> 8) & 255,
            bigint & 255
        ];
    }

    function load_image(src: string): Promise<ImageData> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const imgCanvas = document.createElement("canvas");
                imgCanvas.width = img.width;
                imgCanvas.height = img.height;

                const imgCtx = imgCanvas.getContext("2d");
                if(!imgCtx) {
                    throw new Error("Failed to get image canvas context");
                }

                imgCtx.drawImage(img, 0, 0);
                resolve(imgCtx.getImageData(0, 0, img.width, img.height));
            }
        });
    }

    let ctx: CanvasRenderingContext2D;
    let data: ImageData;
    let counter = 0;
    let loop: number;
    let scale: number = 5;
    let map: boolean[] = [];

    let sucking: boolean = false;
    let hole: { x: number, y: number, r: number } | null = null;

    const onResize = () => {
        canvas.width = Math.floor(canvas.offsetWidth / scale);
        canvas.height = Math.floor(canvas.offsetHeight / scale);

        console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
        data = ctx.createImageData(canvas.width, canvas.height);
        map = new Array(canvas.width * canvas.height).fill(false);
    }

    const onMouseDown = (event: MouseEvent) => {
        const x = Math.floor(event.clientX / scale);
        const y = Math.floor(event.clientY / scale);

        if(x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
            return;
        }

        const radius = 8;
        hole = { x, y, r: radius };
        sucking = true;
    }

    const onMouseMove = (event: MouseEvent) => {
        const x = Math.floor(event.clientX / scale);
        const y = Math.floor(event.clientY / scale);

        if(x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
            return;
        }

        const radius = 8;
        hole = { x, y, r: radius };
    }

    const onMouseUp = () => {
        hole = null;
        sucking = false;
    }

    const onTouchStart = (event: TouchEvent) => {
        if(event.touches.length === 0) {
            return;
        }

        const touch = event.touches[0];
        const x = Math.floor(touch.clientX / scale);
        const y = Math.floor(touch.clientY / scale);

        if(x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
            return;
        }

        const radius = 8;
        hole = { x, y, r: radius };
        sucking = true;
    }

    const onTouchMove = (event: TouchEvent) => {
        if(event.touches.length === 0) {
            return;
        }

        const touch = event.touches[0];
        const x = Math.floor(touch.clientX / scale);
        const y = Math.floor(touch.clientY / scale);

        if(x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
            return;
        }

        const radius = 8;
        hole = { x, y, r: radius };
    }

    const onTouchEnd = () => {
        hole = null;
        sucking = false;
    }
    
    let marioImage: ImageData;

    const main = () => {
        ctx = canvas.getContext("2d")!;
        if(!ctx) {
            throw new Error("Failed to get canvas context");
        }

        ctx.imageSmoothingEnabled = false;

        const clear = () => {
            if(!data) {
                return;
            }

            for(let i = 0; i < data.data.length; i += 4) {
                data.data[i] = 0;     // Red
                data.data[i + 1] = 0; // Green
                data.data[i + 2] = 0; // Blue
                data.data[i + 3] = 255; // Alpha
            }
        }

        const put_pixel = (x: number, y: number, r: number, g: number, b: number, a: number) => {
            const index = (y * canvas.width + x) * 4;
            if(index < 0 || index >= data.data.length) {
                return;
            }

            data.data[index] = r;
            data.data[index + 1] = g;
            data.data[index + 2] = b;
            data.data[index + 3] = a;
        }

        const is_pixel = (x: number, y: number) => {
            const index = (y * canvas.width + x) * 4;
            if(index < 0 || index >= data.data.length) {
                return true;
            }

            const is_rgb = data.data[index] !== 0 || data.data[index + 1] !== 0 || data.data[index + 2] !== 0;
            return is_rgb;
        }

        const is_blocked = (x: number, y: number) => {
            const index = y * canvas.width + x;
            if(index < 0 || index >= map.length) {
                return true;
            }

            return map[index];
        }

        const swap_pixels = (x0: number, y0: number, x1: number, y1: number) => {
            const i0 = (y0 * canvas.width + x0) * 4;
            const i1 = (y1 * canvas.width + x1) * 4;

            if(i0 < 0 || i0 >= data.data.length || i1 < 0 || i1 >= data.data.length) {
                return;
            }

            const t0 = data.data[i0];
            const t1 = data.data[i0 + 1];
            const t2 = data.data[i0 + 2];
            const t3 = data.data[i0 + 3];

            data.data[i0] = data.data[i1];
            data.data[i0 + 1] = data.data[i1 + 1];
            data.data[i0 + 2] = data.data[i1 + 2];
            data.data[i0 + 3] = data.data[i1 + 3];
            data.data[i1] = t0;
            data.data[i1 + 1] = t1;
            data.data[i1 + 2] = t2;
            data.data[i1 + 3] = t3;
        }

        const put_rect = (x: number, y: number, width: number, height: number, r: number, g: number, b: number, a: number) => {
            x = Math.floor(x);
            y = Math.floor(y);
            width = Math.floor(width);
            height = Math.floor(height);

            for(let i = 0; i < height; i++) {
                for(let j = 0; j < width; j++) {
                    put_pixel(x + j, y + i, r, g, b, a);
                    map[(y + i) * canvas.width + (x + j)] = true;
                }
            }
        }

        const put_image = (img: ImageData, x: number, y: number) => {
            const data = img.data;
            for(let i = 0; i < data.length; i += 4) {
                if(data[i + 3] === 0) {
                    continue; // Skip transparent pixels
                }

                const px = (i / 4) % img.width;
                const py = Math.floor((i / 4) / img.width);

                const canvasX = x + px;
                const canvasY = y + py;

                if(canvasX < 0 || canvasX >= canvas.width || canvasY < 0 || canvasY >= canvas.height) {
                    continue;
                }

                put_pixel(canvasX, canvasY, data[i], data[i + 1], data[i + 2], data[i + 3]);
                map[canvasY * canvas.width + canvasX] = true;
            }
        }

        let elapsed = 0;

        const frame = (delta: number) => {
            elapsed += delta;
            counter += 1;
            
            const addPoint = (x: number, y: number, onlyIfNotTaken: boolean = false) => {
                if(onlyIfNotTaken && is_pixel(x, y)) {
                    return null;
                }

                put_pixel(x, y, ...hexToRgb(pickColor(snowPalette, snowWeights)), 255);
            }

            if(hole && sucking) {
                const { x, y, r } = hole;
                for(let i = -r; i <= r; i++) {
                    for(let j = -r; j <= r; j++) {
                        if(i * i + j * j <= r * r) {
                            const px = x + i;
                            const py = y + j;

                            if(px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) {
                                continue;
                            }

                            if(is_blocked(px, py)) {
                                continue;
                            }

                            put_pixel(px, py, 0, 0, 0, 255);
                        }
                    }
                }
            }

            if(counter % (skipFrames) != 0) {
                return;
            }

            for(let y = canvas.height - 1; y >= 0; --y) {
                for(let x = 0; x < canvas.width; ++x) {
                    if(!is_pixel(x, y) || is_blocked(x, y)) {
                        continue;
                    }

                    const is_bottom = y < canvas.height - 1 && !is_pixel(x, y + 1);
                    if(is_bottom) {
                        swap_pixels(x, y, x, y + 1);
                    }
                }

                for(let x = 0; x < canvas.width; ++x) {
                    if(!is_pixel(x, y) || is_blocked(x, y)) {
                        continue;
                    }

                    const can_left = x > 0 && !is_pixel(x - 1, y + 1);
                    const can_right = x < canvas.width - 1 && !is_pixel(x + 1, y + 1);

                    if(can_left && can_right) {
                        if(Math.random() < 0.5) {
                            swap_pixels(x, y, x - 1, y + 1);
                        } else {
                            swap_pixels(x, y, x + 1, y + 1);
                        }
                    } else if(can_left) {
                        swap_pixels(x, y, x - 1, y + 1);
                    } else if(can_right) {
                        swap_pixels(x, y, x + 1, y + 1);
                    }
                }
            }

            if(counter % 1 == 0) {
                let amount = shouldSnow ? Math.floor(canvas.width / 10) : 0;
                for(let i = 0; i < amount; ++i) {
                    addPoint(Math.floor(Math.random() * canvas.width), 0, true);
                }
            }

            ctx.putImageData(data, 0, 0);
        };

        let zero = 0;

        window.addEventListener("resize", onResize);
        window.addEventListener("touchstart", onTouchStart);
        window.addEventListener("touchmove", onTouchMove);
        window.addEventListener("touchend", onTouchEnd);
        window.addEventListener("touchcancel", onTouchEnd);
        window.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("mouseout", onMouseUp);

        onResize();
        clear();

        loop = requestAnimationFrame(function draw(time) {
            if(!canvas || !ctx) {
                return;
            }

            const delta = time - zero;
            zero = time;

            frame(delta);
            requestAnimationFrame(draw);
        });
    }
    
    onMount(() => {
        load_image(marioSrc).then(imgData => {
            marioImage = imgData;
            main();
        }).catch(err => {
            console.error("Failed to load image:", err);
        });

        return () => {
            cancelAnimationFrame(loop);
            
            window.removeEventListener("resize", onResize);
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
            window.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("mouseout", onMouseUp);
        }
    });
</script>

<main class="h-full bg-black text-white flex items-center justify-center">
    <canvas class="absolute top-0 left-0 w-full h-full" style="image-rendering: pixelated; touch-action: none;" bind:this={canvas}></canvas>
    <div class="absolute top-2 right-2 flex flex-col gap-2 items-end">
        <div class="flex flex-row gap-2 items-center justify-center">
            <span class="text-white text-xl">SNOW</span>
            <input type="checkbox" bind:checked={shouldSnow}/>
        </div>
        <div class="flex flex-row gap-2 items-center justify-center">
            <span class="text-white text-xl">SKIP</span>
            <input type="number" min=1 bind:value={skipFrames}/>
        </div>
    </div>

    <footer class="absolute bottom-1 text-white text-shadow-black text-shadow-lg text-lg font-bold z-10" style="touch-action: none;">
        <p>y3v4d © 2025</p>
    </footer>
</main>
