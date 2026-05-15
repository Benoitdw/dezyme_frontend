<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { tools, toolList } from '$lib/tools';
	import type { ToolId } from '$lib/tools';
	import PdbInput from '$lib/components/pdb/PdbInput.svelte';
	import PdbMetadata from '$lib/components/pdb/PdbMetadata.svelte';
	import ChainSelector from '$lib/components/pdb/ChainSelector.svelte';
	import { submitAnalysis } from '$lib/utils/api';
	import { addJob } from '$lib/utils/storage';
	import type { PdbMetadata as PdbMeta } from '$lib/utils/pdb';
	import SoftIdCard from '$lib/components/SoftIdCard.svelte';
	import MutationList from '$lib/components/MutationList.svelte';

	let selectedTool = $state<ToolId>(($page.url.searchParams.get('tool') as ToolId) ?? 'popmusic');
	let pdbMeta = $state<PdbMeta | null>(null);
	let selectedChains = $state<string[]>([]);
	let pdbError = $state<string | null>(null);
	let submitting = $state(false);
	let transitioning = $state(false);
	let fieldValues = $state<Record<string, string>>({});
	let fieldErrors = $state<Record<string, string>>({});
	let mutations = $state<string[] | null>(null);  // null = systematic

	function validateField(name: string, raw: string) {
		const field = tool.fields.find((f) => f.name === name);
		if (!field || raw === '') { fieldErrors[name] = ''; return; }
		const v = parseFloat(raw);
		if (isNaN(v)) { fieldErrors[name] = 'Must be a number'; return; }
		if (field.min !== undefined && v < field.min) {
			fieldErrors[name] = `Min ${field.min} ${field.unit ?? ''}`.trim();
			return;
		}
		if (field.max !== undefined && v > field.max) {
			fieldErrors[name] = `Max ${field.max} ${field.unit ?? ''}`.trim();
			return;
		}
		fieldErrors[name] = '';
	}

	function setField(name: string, value: string) {
		fieldValues[name] = value;
		validateField(name, value);
	}

	let hasFieldErrors = $derived(Object.values(fieldErrors).some((e) => e !== ''));

	let tool = $derived(tools[selectedTool]);

	$effect(() => {
		document.body.setAttribute('data-tool', selectedTool);
		return () => document.body.removeAttribute('data-tool');
	});

	async function onToolChange(id: ToolId) {
		transitioning = true;
		document.body.classList.add('tool-transitioning');
		await new Promise<void>((r) => setTimeout(r, 280));
		selectedTool = id;
		if (pdbMeta) {
			selectedChains = tools[id].chainRule.preselect(pdbMeta.chains);
		}
		document.body.classList.remove('tool-transitioning');
		transitioning = false;
	}

	function onPdbLoaded(meta: PdbMeta) {
		pdbMeta = meta;
		pdbError = null;
		selectedChains = tool.chainRule.preselect(meta.chains);
	}

	function onPdbError(msg: string) {
		pdbError = msg;
		pdbMeta = null;
		selectedChains = [];
	}

	async function handleSubmit() {
		if (!pdbMeta || selectedChains.length === 0) return;
		submitting = true;
		try {
			const id = await submitAnalysis({
				tool: selectedTool,
				structureId: pdbMeta.id,
				chains: selectedChains,
				params: { ...fieldValues, ...(mutations !== null ? { mutations: mutations.join(',') } : {}) }
			});
			addJob({ id, tool: selectedTool, structureId: pdbMeta.id });
			goto(`${base}/results/${id}`);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="page" data-tool={selectedTool} class:transitioning>
	<div class="tool-tabs">
		{#each toolList as t}
			<button
				class="tab"
				class:active={selectedTool === t.id}
				style="--accent: {t.accent}"
				onclick={() => onToolChange(t.id)}
				type="button"
			>
				{t.name}
			</button>
		{/each}
	</div>

	<div class="form-card">
		<SoftIdCard {tool} />

		{#if tool.comingSoon}
			<div class="coming-soon" style="--c: {tool.accent}">
				<span class="coming-soon-icon">🚧</span>
				<div class="coming-soon-body">
					<p class="coming-soon-title">Not yet available on this platform</p>
					{#if tool.legacyUrl}
						<p class="coming-soon-hint">
							You can still use the previous version at
							<a href={tool.legacyUrl} target="_blank" rel="noopener noreferrer" class="coming-soon-link">{tool.legacyUrl}</a>
						</p>
					{:else}
						<p class="coming-soon-hint">This tool will be available in an upcoming release.</p>
					{/if}
				</div>
			</div>
		{:else}
			<section class="section">
				<label class="section-label">Structure</label>
				<PdbInput onLoaded={onPdbLoaded} onError={onPdbError} />
				{#if pdbError}
					<p class="error">{pdbError}</p>
				{/if}
			</section>

			{#if pdbMeta}
				<section class="section">
					<label class="section-label">Metadata</label>
					<PdbMetadata meta={pdbMeta} {selectedChains} accent={tool.accent} />
				</section>

				<section class="section">
					<label class="section-label">Chain selection</label>
					<ChainSelector
						chains={pdbMeta.chains}
						chainRule={tool.chainRule}
						bind:selected={selectedChains}
						onChange={(s) => (selectedChains = s)}
					/>
				</section>
			{/if}

			{#if tool.fields.length > 0}
				<section class="section">
					<label class="section-label">Parameters</label>
					<div class="fields">
						{#each tool.fields as field}
							{@const val = fieldValues[field.name] ?? ''}
							{@const err = fieldErrors[field.name] ?? ''}
							<div class="field">
								<label class="field-label" for={field.name}>{field.label}</label>
								<div class="field-input-row">
									<input
										id={field.name}
										type="number"
										min={field.min}
										max={field.max}
										step={field.step ?? 'any'}
										placeholder={field.placeholder ?? ''}
										value={val}
										oninput={(e) => setField(field.name, (e.target as HTMLInputElement).value)}
										class="field-input"
										class:invalid={err !== ''}
									/>
									{#if field.unit}
										<span class="field-unit">{field.unit}</span>
									{/if}
									{#if val !== ''}
										<button
											type="button"
											class="field-clear"
											onclick={() => setField(field.name, '')}
											aria-label="Reset to unknown"
										>×</button>
									{/if}
								</div>
								{#if err !== ''}
									<p class="field-error">{err}</p>
								{:else if field.hint}
									<p class="field-hint">{field.hint}</p>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if tool.mutationList && pdbMeta}
				<section class="section">
					<span class="section-label">Mutations</span>
					<MutationList
						residues={pdbMeta.residues}
						onchange={(m) => (mutations = m)}
					/>
				</section>
			{/if}

			<button
				class="submit-btn"
				style="--accent: {tool.accent}"
				onclick={handleSubmit}
				disabled={!pdbMeta || selectedChains.length === 0 || submitting || hasFieldErrors}
				type="button"
			>
				{submitting ? 'Submitting...' : `Run ${tool.name}`}
			</button>
		{/if}
	</div>
</div>

<style>
	.page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2.5rem 2rem;
		position: relative;
		border-radius: 1.25rem;
		transition: opacity 0.28s ease;
	}

	.page.transitioning {
		opacity: 0;
	}

	/* ── hotmusic — fire & heat ─────────────────────────────────── */

	.page[data-tool='hotmusic'] :global(.form-card) {
		border-color: rgba(251, 113, 30, 0.3);
		box-shadow: 0 0 28px rgba(251, 113, 30, 0.12), 0 0 72px rgba(239, 68, 68, 0.06);
		animation: ember-glow 4s ease-in-out infinite;
	}

	@keyframes ember-glow {
		0%, 100% { box-shadow: 0 0 28px rgba(251, 113, 30, 0.12), 0 0 72px rgba(239, 68, 68, 0.06); }
		50% { box-shadow: 0 0 40px rgba(251, 113, 30, 0.22), 0 0 90px rgba(239, 68, 68, 0.12); }
	}

	.page[data-tool='hotmusic'] :global(.section-label) {
		color: #c2410c;
	}

	.page[data-tool='hotmusic'] :global(.submit-btn) {
		background: linear-gradient(135deg, #ea580c, #dc2626);
	}

	/* ── popmusic — bubbly & vivid ──────────────────────────────── */

	.page[data-tool='popmusic'] :global(.form-card) {
		border-color: rgba(236, 72, 153, 0.2);
	}

	.page[data-tool='popmusic'] :global(.section-label) {
		color: #db2777;
	}

	.page[data-tool='popmusic'] :global(.submit-btn) {
		background: linear-gradient(135deg, #ec4899, #a855f7);
	}

	/* ── snpmusic — mutations & genomics ────────────────────────── */

	.page[data-tool='snpmusic'] :global(.form-card) {
		border-color: rgba(16, 185, 129, 0.25);
	}

	.page[data-tool='snpmusic'] :global(.section-label) {
		font-family: 'Courier New', Courier, monospace;
		color: #059669;
		letter-spacing: 0.1em;
	}

	.page[data-tool='snpmusic'] :global(.submit-btn) {
		background: linear-gradient(135deg, #059669, #0284c7);
	}

	/* ── beatmusic — cardiac rhythm / EKG ──────────────────────── */

	.page[data-tool='beatmusic'] :global(.form-card) {
		border-color: rgba(225, 29, 72, 0.25);
		animation: heartbeat-glow 1.6s ease-in-out infinite;
	}

	/* lub … dub … rest */
	@keyframes heartbeat-glow {
		0%,  100% { box-shadow: 0 0 18px rgba(225, 29, 72, 0.07), 0 0 56px rgba(225, 29, 72, 0.03); }
		15%        { box-shadow: 0 0 36px rgba(225, 29, 72, 0.28), 0 0 80px rgba(225, 29, 72, 0.10); }
		30%        { box-shadow: 0 0 18px rgba(225, 29, 72, 0.09), 0 0 56px rgba(225, 29, 72, 0.04); }
		45%        { box-shadow: 0 0 48px rgba(225, 29, 72, 0.34), 0 0 100px rgba(225, 29, 72, 0.14); }
		65%        { box-shadow: 0 0 18px rgba(225, 29, 72, 0.07), 0 0 56px rgba(225, 29, 72, 0.03); }
	}

	.page[data-tool='beatmusic'] :global(.section-label) {
		color: #be123c;
		font-family: 'Courier New', Courier, monospace;
		letter-spacing: 0.07em;
	}

	.page[data-tool='beatmusic'] :global(.submit-btn) {
		background: linear-gradient(135deg, #e11d48, #be123c);
	}

	/* ── soulmusic — golden mist / spectral swamp ───────────────── */

	.page[data-tool='soulmusic'] :global(.form-card) {
		border-color: rgba(136, 152, 184, 0.40);
		animation: wisp-glow 11s ease-in-out infinite;
	}

	/* Three uneven peaks — feels like a will-o'-wisp, not a metronome */
	@keyframes wisp-glow {
		0%   { box-shadow: 0 0 28px rgba(136, 152, 184, 0.07), 0 0 70px rgba(136, 152, 184, 0.03); }
		12%  { box-shadow: 0 0 55px rgba(136, 152, 184, 0.18), 0 0 110px rgba(136, 152, 184, 0.08); }
		25%  { box-shadow: 0 0 22px rgba(136, 152, 184, 0.05), 0 0 55px rgba(136, 152, 184, 0.02); }
		48%  { box-shadow: 0 0 72px rgba(136, 152, 184, 0.24), 0 0 140px rgba(136, 152, 184, 0.10); }
		65%  { box-shadow: 0 0 18px rgba(136, 152, 184, 0.04), 0 0 48px rgba(136, 152, 184, 0.02); }
		79%  { box-shadow: 0 0 40px rgba(136, 152, 184, 0.12), 0 0 88px rgba(136, 152, 184, 0.05); }
		100% { box-shadow: 0 0 28px rgba(136, 152, 184, 0.07), 0 0 70px rgba(136, 152, 184, 0.03); }
	}

	.page[data-tool='soulmusic'] :global(.section-label) {
		color: #6878a0;
	}

	.page[data-tool='soulmusic'] :global(.submit-btn) {
		background: linear-gradient(135deg, #6878a0, #8898b8);
	}

	/* ── Coming soon panel ──────────────────────────────────────── */

	.coming-soon {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		background: color-mix(in srgb, var(--c) 6%, var(--bg));
		border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
		border-radius: 0.75rem;
		padding: 1.25rem 1.5rem;
	}

	.coming-soon-icon {
		font-size: 1.5rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.coming-soon-body {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.coming-soon-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text);
	}

	.coming-soon-hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.55;
	}

	.coming-soon-link {
		color: var(--c);
		word-break: break-all;
	}

	.coming-soon-link:hover {
		text-decoration: underline;
	}

	.tool-tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 0.25rem;
	}

	.tab {
		flex: 1;
		background: none;
		border: none;
		border-radius: 0.5rem;
		padding: 0.6rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.tab.active {
		background: var(--bg);
		color: var(--accent);
		font-weight: 700;
	}

	.form-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.section-label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field-label {
		font-size: 0.875rem;
		color: var(--text);
	}

	.field-input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.field-input {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.45rem 0.75rem;
		font-size: 0.875rem;
		color: var(--text);
		width: 160px;
		transition: border-color 0.15s;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--text-muted);
	}

	.field-input.invalid {
		border-color: #ef4444;
	}

	.field-unit {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.field-clear {
		background: none;
		border: none;
		padding: 0 0.25rem;
		font-size: 1rem;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		transition: color 0.15s;
	}

	.field-clear:hover {
		color: var(--text);
	}

	.field-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.field-error {
		font-size: 0.78rem;
		color: #ef4444;
	}

	.error {
		font-size: 0.85rem;
		color: #ef4444;
	}

	.submit-btn {
		background: var(--accent);
		border: none;
		border-radius: 0.625rem;
		padding: 0.85rem;
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.submit-btn:hover:not(:disabled) {
		opacity: 0.88;
	}

	.submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
