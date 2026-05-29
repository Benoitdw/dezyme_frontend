<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import PopmusicEvolResults from '$lib/components/results/PopmusicEvolResults.svelte';
	import DiffuseSineHorizon from '$lib/components/DiffuseSineHorizon.svelte';

	let { data } = $props();

	onMount(() => {
		document.body.setAttribute('data-tool', 'popmusic');
		return () => document.body.removeAttribute('data-tool');
	});
</script>

<DiffuseSineHorizon />
<PopmusicEvolResults
	mutations={data.mutations}
	pdbUrl={data.pdbUrl}
	fastaContent={data.fastaContent}
	zipUrl={data.zipUrl}
	lambda={data.lambda}
	logContent={data.logContent}
	title="6acv A:29-94 — Example results"
	subtitle="Example · PopMuSiC Evol · AlphaFold2 · Chain A"
	backUrl="{base}/run?tool=popmusic"
/>
