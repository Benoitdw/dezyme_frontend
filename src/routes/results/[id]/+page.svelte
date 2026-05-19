<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { tools } from '$lib/tools';
	import { getJobStatus, getJobPayload } from '$lib/utils/api';
	import { parsePops, parsePop } from '$lib/utils/popmusic';
	import { parsePdbFile } from '$lib/utils/pdb';
	import type { JobPayloadSummary, JobStatus } from '$lib/utils/api';
	import type { SummaryRow, MutationRow } from '$lib/utils/popmusic';
	import type { PdbMetadata } from '$lib/utils/pdb';
	import ProteinPending from '$lib/components/ProteinPending.svelte';
	import DiffuseSineHorizon from '$lib/components/DiffuseSineHorizon.svelte';
	import PopmusicResults from '$lib/components/results/PopmusicResults.svelte';

	const analysisId = $page.params.id ?? '';

	let status  = $state<JobStatus>('pending');
	let error   = $state<string | null>(null);
	let payload = $state<JobPayloadSummary | null>(null);
	let tool    = $derived(payload ? tools[payload.tool] : null);
	let showPayload = $state(false);
	let interval: ReturnType<typeof setInterval> | null = null;

	// Results state (populated when done)
	let resultSummary   = $state<SummaryRow[] | null>(null);
	let resultMutations = $state<MutationRow[] | null>(null);
	let resultMeta      = $state<PdbMetadata | null>(null);
	let resultPdbUrl    = $state<string | null>(null);
	let resultPopsFile  = $state<string | null>(null);
	let resultPopFile   = $state<string | null>(null);
	let resultPdbFile   = $state<string | null>(null);

	async function loadResults(p: JobPayloadSummary) {
		if (p.tool !== 'popmusic') return;

		const outputBase = `/api/analysis/${analysisId}/output`;

		// List output files then find by extension
		const files: string[] = await fetch(outputBase).then((r) => r.json());
		const popsFile = files.find((f) => f.endsWith('.pops'));
		const popFile  = files.find((f) => f.endsWith('.pop') && !f.endsWith('.pops'));
		const pdbFile  = files.find((f) => f.endsWith('.pdb'));
		if (!popsFile || !popFile || !pdbFile) return;

		const [popsText, popText, pdbText] = await Promise.all([
			fetch(`${outputBase}/${popsFile}`).then((r) => r.text()),
			fetch(`${outputBase}/${popFile}`).then((r) => r.text()),
			fetch(`${outputBase}/${pdbFile}`).then((r) => r.text()),
		]);

		const meta = parsePdbFile(pdbText);
		meta.id = p.structureId;

		resultSummary   = parsePops(popsText);
		resultMutations = parsePop(popText);
		resultMeta      = meta;
		resultPdbUrl    = `${outputBase}/${pdbFile}`;
		resultPopsFile  = popsFile;
		resultPopFile   = popFile;
		resultPdbFile   = pdbFile;
	}

	async function poll() {
		try {
			const res = await getJobStatus(analysisId);
			const prev = status;
			status = res.status;
			if (res.error) error = res.error;

			if (status === 'done' || status === 'error') {
				if (interval) clearInterval(interval);
			}
			if (status === 'done' && prev !== 'done' && payload) {
				loadResults(payload);
			}
		} catch {
			// keep polling
		}
	}

	onMount(() => {
		getJobPayload(analysisId).then((p) => {
			payload = p;
			if (p) document.body.setAttribute('data-tool', p.tool);
			if (p && status === 'done') loadResults(p);
		});
		poll();
		interval = setInterval(poll, 3000);
		return () => {
			if (interval) clearInterval(interval);
			document.body.removeAttribute('data-tool');
		};
	});

	function copyId() { navigator.clipboard.writeText(analysisId); }
</script>

<DiffuseSineHorizon />

{#if status === 'done' && resultSummary && resultMutations && resultMeta && resultPdbUrl && resultPopsFile && resultPopFile && resultPdbFile && payload}
	<PopmusicResults
		{analysisId}
		structureId={payload.structureId}
		summary={resultSummary}
		mutations={resultMutations}
		meta={resultMeta}
		pdbUrl={resultPdbUrl}
		popsFile={resultPopsFile}
		popFile={resultPopFile}
		pdbFile={resultPdbFile}
	/>
{:else}
	<div class="page">
		<div class="header">
			<div class="title-row">
				{#if tool}
					<span class="tool-badge" style="--accent: {tool.accent}">{tool.name}</span>
				{/if}
				<span class="analysis-id">{analysisId}</span>
			</div>
			<div class="actions">
				<button class="action-btn" onclick={copyId} type="button">Copy ID</button>
				<a href="{base}/run{tool ? `?tool=${tool.id}` : ''}" class="action-btn">New analysis</a>
			</div>
		</div>

		{#if status === 'done'}
			<!-- Results loading -->
			<div class="status-block">
				<span class="status-text">Loading results…</span>
			</div>
		{:else if status === 'error'}
			<div class="status-block error">
				<span class="status-icon">✗</span>
				<div>
					<div class="status-text">Analysis failed</div>
					{#if error}<div class="status-sub">{error}</div>{/if}
				</div>
			</div>
		{:else}
			<ProteinPending label={status === 'running' ? 'Running…' : 'Pending…'} />

			{#if payload}
				<div class="payload-section">
					<button class="payload-toggle" onclick={() => { showPayload = !showPayload; }} type="button">
						{showPayload ? 'Hide' : 'View'} submitted payload
					</button>
					{#if showPayload}
						<div class="payload-card">
							<div class="payload-row"><span class="payload-key">tool</span><span class="payload-val">{payload.tool}</span></div>
							<div class="payload-row"><span class="payload-key">structure</span><span class="payload-val">{payload.structureId}</span></div>
							<div class="payload-row"><span class="payload-key">chains</span><span class="payload-val">{payload.chains.join(', ')}</span></div>
							{#if payload.pdb}
								<div class="payload-row"><span class="payload-key">pdb</span><span class="payload-val">{(payload.pdb.bytes / 1024).toFixed(1)} KB</span></div>
							{/if}
							{#if payload.msa}
								<div class="payload-row"><span class="payload-key">msa</span><span class="payload-val">{payload.msa.filename} — {payload.msa.lines.toLocaleString()} lines, {(payload.msa.bytes / 1024).toFixed(1)} KB</span></div>
							{/if}
							{#if Object.keys(payload.params).length > 0}
								<div class="payload-row"><span class="payload-key">params</span><span class="payload-val">{JSON.stringify(payload.params)}</span></div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.page { max-width: 900px; margin: 0 auto; padding: 2.5rem 2rem; display: flex; flex-direction: column; gap: 2rem; }
	.header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
	.title-row { display: flex; align-items: center; gap: 0.75rem; }
	.tool-badge { font-size: 0.8rem; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 0.375rem; padding: 0.25rem 0.6rem; }
	.analysis-id { font-family: monospace; font-size: 1rem; color: var(--text-muted); }
	.actions { display: flex; gap: 0.5rem; }
	.action-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.4rem 0.875rem; font-size: 0.85rem; color: var(--text); cursor: pointer; text-decoration: none; transition: border-color 0.15s; }
	.action-btn:hover { border-color: var(--text-muted); }
	.status-block { display: flex; align-items: center; gap: 1.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; }
	.status-block.error { border-color: #ef4444; }
	.status-icon { font-size: 1.5rem; color: #ef4444; }
	.status-text { font-size: 1rem; font-weight: 600; color: var(--text); }
	.status-sub { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem; }
	.payload-section { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }
	.payload-toggle { background: none; border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.4rem 0.875rem; font-size: 0.82rem; color: var(--text-muted); cursor: pointer; transition: border-color 0.15s, color 0.15s; }
	.payload-toggle:hover { border-color: var(--text-muted); color: var(--text); }
	.payload-card { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
	.payload-row { display: flex; gap: 1rem; font-size: 0.82rem; }
	.payload-key { color: var(--text-muted); font-family: monospace; min-width: 80px; flex-shrink: 0; }
	.payload-val { color: var(--text); font-family: monospace; word-break: break-all; }
</style>
