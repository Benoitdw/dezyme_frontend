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
	import DiffuseSineHorizon from '$lib/components/DiffuseSineHorizon.svelte';

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
		return () => {
			document.body.removeAttribute('data-tool');
		};
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

<DiffuseSineHorizon />

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

	@media (max-width: 640px) {
		.page {
			padding: 1.25rem 1rem;
		}

		.form-card {
			padding: 1.25rem 1rem;
		}
	}

	.page.transitioning {
		opacity: 0;
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

	@media (max-width: 640px) {
		.tool-tabs {
			flex-direction: column;
		}

		.tab {
			flex: none;
			text-align: left;
			padding: 0.65rem 1rem;
		}
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
