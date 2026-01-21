<script lang="ts">
    interface Props {
        x: number;
        y: number;
        icon: string;
        label: string;
        onClick?: () => void;
    }

    let { 
        x,
        y,
        icon, 
        label,
        onClick
    }: Props = $props();

    let audioElement: HTMLAudioElement;

    function handleClick() {
        audioElement.currentTime = 0;
        audioElement.play();

        onClick?.();
    }
</script>

<button style="left: {x}px; top: {y}px;" class="absolute flex flex-col items-center -translate-1/2 w-16 gap-2 select-none cursor-pointer" onclick={handleClick}>
    <audio bind:this={audioElement} src="/audio_navigation.mp3" preload="auto"></audio>
    <img src={icon} alt={label} class="w-8 h-8 pointer-events-none" style="image-rendering: pixelated;"/>
    <div class="h-4 w-full">
        <span class="text-white text-center break-words leading-4 pointer-events-none">{label}</span>
    </div>
</button>