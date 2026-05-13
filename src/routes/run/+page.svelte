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

	let selectedTool = $state<ToolId>(($page.url.searchParams.get('tool') as ToolId) ?? 'popmusic');
	let pdbMeta = $state<PdbMeta | null>(null);
	let selectedChains = $state<string[]>([]);
	let pdbError = $state<string | null>(null);
	let submitting = $state(false);
	let transitioning = $state(false);
	let fieldValues = $state<Record<string, string>>({});
	let fieldErrors = $state<Record<string, string>>({});

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
				params: fieldValues
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

		<button
			class="submit-btn"
			style="--accent: {tool.accent}"
			onclick={handleSubmit}
			disabled={!pdbMeta || selectedChains.length === 0 || submitting || hasFieldErrors}
			type="button"
		>
			{submitting ? 'Submitting...' : `Run ${tool.name}`}
		</button>
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
