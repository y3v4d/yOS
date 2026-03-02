import type { Kernel } from "./kernel";

class AudioCore {
    private _cache: Map<string, HTMLAudioElement> = new Map();

    constructor(
        readonly kernel: Kernel
    ) {}

    play(path: string) {
        let audio = this._cache.get(path);
        if(!audio) {
            audio = new Audio(path);
            this._cache.set(path, audio);
        }

        audio.currentTime = 0;
        audio.play();
    }

    async preload(path: string) {
        return new Promise<void>((resolve, reject) => {
            let audio = this._cache.get(path);
            if(!audio) {
                audio = new Audio(path);
                this._cache.set(path, audio);
            }

            audio.addEventListener("canplaythrough", () => {
                resolve();
            });

            audio.addEventListener("error", (e) => {
                reject(e);
            });

            audio.load();
        });
    }
}

export { AudioCore };