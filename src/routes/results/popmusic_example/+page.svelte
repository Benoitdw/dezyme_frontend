<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import PopmusicResults from '$lib/components/results/PopmusicResults.svelte';
	import DiffuseSineHorizon from '$lib/components/DiffuseSineHorizon.svelte';

	let { data } = $props();

	const prefix = `${base}/examples/popmusic/pop_example`;

	onMount(() => {
		document.body.setAttribute('data-tool', 'popmusic');
		return () => document.body.removeAttribute('data-tool');
	});
</script>

<DiffuseSineHorizon />
<PopmusicResults
	structureId={data.meta.id}
	summary={data.summary}
	mutations={data.mutations}
	meta={data.meta}
	pdbUrl={data.pdbUrl}
	title="p53 — Example results"
	subtitle="Example · PopMuSiC v3.1 · PDB 8E7B"
	backUrl="{base}/run?tool=popmusic"
	downloadUrls={{
		pops: `${prefix}/p53.pops`,
		pop:  `${prefix}/p53.pop`,
		pdb:  `${prefix}/p53.pdb`,
	}}
/>
