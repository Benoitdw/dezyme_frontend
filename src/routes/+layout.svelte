<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import AcademicGate from '$lib/components/AcademicGate.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Dezyme</title>
	<meta name="description" content="Protein mutation analysis tools" />
</svelte:head>

<AcademicGate />
<Navbar />
<main>
	{@render children()}
</main>
<Footer />

<style>
	main {
		min-height: calc(100vh - 57px - 110px);
	}
</style>
