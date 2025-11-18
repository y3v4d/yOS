<script lang="ts">
	import '../app.css';
	
	let { children } = $props();
</script>

<svelte:head>
	<title>yOS</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
</svelte:head>
{@render children()}
