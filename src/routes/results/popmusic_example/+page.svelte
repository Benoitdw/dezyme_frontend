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
	multipleMutations={data.multipleMutations}
	pdbUrl={data.pdbUrl}
	fastaContent={data.fastaContent}
	zipUrl={data.zipUrl}
	lambda={data.lambda}
	msaNtot={data.msaNtot}
	sigSlope={data.sigSlope}
	sigCenter={data.sigCenter}
	clipThreshold={data.clipThreshold}
	logContent={data.logContent}
	title="P12345 — Example results"
	subtitle="Example · PopMuSiC · AlphaFold2 · Chain A"
	backUrl="{base}/run?tool=popmusic"
/>
