<script lang="ts">
  import { onMount } from "svelte";
  import icon_svelte_svg from "./assets/svelte.svg";

  let angle = $state(0);

  onMount(() => {
    let interval: number;
    const tick = () => {
      angle = (angle + 1) % 360;
      interval = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      clearInterval(interval);
    };
  }); 
</script>

<main class="content-decorated content">
  <p>This window is running Svelte 5.0 context!</p>
  <div class="icon_wrapper">
    <img src={icon_svelte_svg} alt="Svelte Logo" width="64" height="64" style:transform="rotate({angle}deg)" />
  </div>
</main>

<style>
  .content {
    display: flex;
    flex-direction: column;

    background-color: #F0F0F0;
    color: black;
    
    width: 100%;
    height: 100%;
    
    padding: 4px;
    box-sizing: border-box;
  }

  .icon_wrapper {
    display: flex;
    justify-content: center;
    align-items: center;

    flex-grow: 1;
  }
</style>