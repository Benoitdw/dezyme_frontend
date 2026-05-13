<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Dezyme</title>
	<meta name="description" content="Protein mutation analysis tools" />
</svelte:head>

<Navbar />
<main>
	{@render children()}
</main>
