<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import HotmusicResults from '$lib/components/results/HotmusicResults.svelte';
	import DiffuseSineHorizon from '$lib/components/DiffuseSineHorizon.svelte';

	let { data } = $props();

	onMount(() => {
		document.body.setAttribute('data-tool', 'hotmusic');
		return () => document.body.removeAttribute('data-tool');
	});
</script>

<DiffuseSineHorizon />
<HotmusicResults
	summary={data.summary}
	mutations={data.mutations}
	meta={data.meta}
	pdbUrl={data.pdbUrl}
	downloadUrls={data.downloadUrls}
	logContent={data.logContent}
	title="3BIO — Example results"
	subtitle="Example · HoTMuSiC · Chains A, B"
	backUrl="{base}/run?tool=hotmusic"
/>
