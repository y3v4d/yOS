<script lang="ts">
    interface Props {
        icon: string;
        label: string;
        onClick?: () => void;
    }

    let { 
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

<button class="flex flex-col items-center w-16 gap-2 m-4 select-none cursor-pointer" onclick={handleClick}>
    <audio bind:this={audioElement} src="/audio_navigation.mp3" preload="auto"></audio>
    <img src={icon} alt={label} class="w-12 h-12 drop-shadow" style="image-rendering: pixelated;"/>
    <span class="text-lg text-white text-center break-words leading-4">{label}</span>
</button>