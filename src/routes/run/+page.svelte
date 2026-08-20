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
	import MultipleMutationsInput from '$lib/components/MultipleMutationsInput.svelte';
	import MsaInput from '$lib/components/MsaInput.svelte';
	import DiffuseSineHorizon from '$lib/components/DiffuseSineHorizon.svelte';
	import AcademicGate from '$lib/components/AcademicGate.svelte';

	let selectedTool = $state<ToolId>(($page.url.searchParams.get('tool') as ToolId) ?? 'popmusic');
	let pdbMeta = $state<PdbMeta | null>(null);
	let selectedChains = $state<string[]>([]);
	let pdbError = $state<string | null>(null);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let transitioning = $state(false);
	let fieldValues = $state<Record<string, string>>({});
	let fieldErrors = $state<Record<string, string>>({});
	let mutations = $state<string[] | null>(null);  // null = systematic
	let multipleMutations = $state<string[] | null>(null);
	let mutationMsaReference = $state(false);
	let msaContent = $state<string | null>(null);
	let msaFilename = $state<string | null>(null);
	let biologicalAssembly = $state<number | null>(null);
	let gateOpen = $state(false);


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

	// Chains the loaded unit actually contains: a biological unit may hold only a
	// subset of the chains of the asymmetric unit
	function presentChains(meta: PdbMeta): string[] {
		if (meta.assemblyIndex === undefined || !meta.chainCopies) return meta.chains;
		return meta.chains.filter((c) => (meta.chainCopies?.[c] ?? 0) > 0);
	}

	// Composition passed to the chain selector, undefined while on the asymmetric unit
	let unitChainCopies = $derived(
		pdbMeta && pdbMeta.assemblyIndex !== undefined ? pdbMeta.chainCopies : undefined
	);
	let unitLabel = $derived(
		pdbMeta?.assemblyIndex !== undefined ? `assembly ${pdbMeta?.assemblyIndex}` : 'this unit'
	);

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
			selectedChains = tools[id].chainRule.preselect(presentChains(pdbMeta));
		}
		document.body.classList.remove('tool-transitioning');
		transitioning = false;
	}

	function onPdbLoaded(meta: PdbMeta) {
		pdbMeta = meta;
		pdbError = null;
		selectedChains = tool.chainRule.preselect(presentChains(meta));
		msaContent = null;
		msaFilename = null;
		// Keep the unit carried by the meta: onLoaded also fires when a biological
		// unit is selected, and when a .pdb1 file is dropped
		biologicalAssembly = meta.assemblyIndex ?? null;
	}

	function onPdbError(msg: string) {
		pdbError = msg;
		pdbMeta = null;
		selectedChains = [];
	}

	// The academic/commercial gate is shown on every run, deliberately without
	// any persistence: each analysis must be attributed to a declared usage.
	function requestSubmit() {
		if (!pdbMeta || selectedChains.length === 0) return;
		submitError = null;
		gateOpen = true;
	}

	function onAcademicConfirmed() {
		gateOpen = false;
		handleSubmit();
	}

	async function handleSubmit() {
		if (!pdbMeta || selectedChains.length === 0) return;
		submitting = true;
		submitError = null;
		try {
			const id = await submitAnalysis({
				tool: selectedTool,
				structureId: pdbMeta.id,
				pdbFilename: pdbMeta.pdbFilename ?? pdbMeta.id,
				chains: selectedChains,
				biologicalAssembly: biologicalAssembly ?? undefined,
				pdbContent: pdbMeta.pdbContent,
				msaContent: msaContent ?? undefined,
				msaFilename: msaFilename ?? undefined,
				params: {
					...Object.fromEntries(
						Object.entries(fieldValues)
							.filter(([, v]) => v !== '')
							.map(([k, v]) => [k, parseFloat(v)])
					),
					...(mutations !== null ? { mutations } : {}),
					...(multipleMutations !== null ? { multipleMutations, mutationMsaReference } : {})
				}
			});
			addJob({ id, tool: selectedTool, structureId: pdbMeta.id, chains: selectedChains });
			goto(`${base}/results/${id}`);
		} catch (e) {
			submitError = e instanceof Error ? e.message : 'Submission failed. Please try again.';
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
				<span class="section-label">3D Structure</span>
				<PdbInput onLoaded={onPdbLoaded} onError={onPdbError} onBiologicalAssembly={(i) => { biologicalAssembly = i; }} />
				{#if pdbError}
					<p class="error">{pdbError}</p>
				{/if}
			</section>

			{#if pdbMeta}
				<section class="section">
					<span class="section-label">Metadata</span>
					<PdbMetadata meta={pdbMeta} {selectedChains} accent={tool.accent} />
				</section>

				<section class="section">
					<span class="section-label">Chain selection</span>
					<ChainSelector
						chains={pdbMeta.chains}
						chainRule={tool.chainRule}
						bind:selected={selectedChains}
						onChange={(s) => (selectedChains = s)}
						chainInfo={pdbMeta.chainInfo}
						accent={tool.accent}
						chainCopies={unitChainCopies}
						{unitLabel}
					/>
				</section>
			{/if}

			{#if tool.fields.length > 0}
				<section class="section">
					<span class="section-label">Parameters</span>
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

			{#if tool.requiresMsa && pdbMeta}
				<section class="section">
					<span class="section-label">Multiple Sequence Alignment</span>
					{#key pdbMeta.id}
						<MsaInput
							msaUrl={pdbMeta.msaUrl}
							chainSequence={pdbMeta.chainInfo?.[selectedChains[0]]?.sequence}
							queryName="{pdbMeta.id}_{selectedChains[0] ?? 'A'}"
							onLoaded={(content, filename) => { msaContent = content; msaFilename = filename; }}
							onClear={() => { msaContent = null; msaFilename = null; }}
						/>
					{/key}
				</section>
			{/if}

			{#if tool.multipleMutations && pdbMeta}
				<section class="section">
					<span class="section-label">
						Add Multiple mutations <span class="section-optional">optional</span>
						<span class="info-icon">ℹ<span class="tooltip">
							Every single-site mutation of every position is computed by default, so nothing needs to
							be listed here for them. This field is for <strong>multiple mutations</strong> —
							substitutions applied together, whose combined effect is reported as one entry. Single
							mutations can be listed here too: they then get their own row in the results, which makes
							the ones you care about easier to find.
						</span></span>
					</span>
					<MultipleMutationsInput
						chain={selectedChains[0]}
						onchange={(m, msaRef) => { multipleMutations = m; mutationMsaReference = msaRef; }}
					/>
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

			{#if submitError}
				<p class="submit-error">{submitError}</p>
			{/if}

			<button
				class="submit-btn"
				style="--accent: {tool.accent}"
				onclick={requestSubmit}
				disabled={!pdbMeta || selectedChains.length === 0 || submitting || hasFieldErrors || (tool.requiresMsa && !msaContent)}
				type="button"
			>
				{submitting ? 'Submitting...' : `Run ${tool.name}`}
			</button>
		{/if}
	</div>
</div>

<AcademicGate open={gateOpen} onAcademic={onAcademicConfirmed} onCancel={() => (gateOpen = false)} />

<style>
	.page {
		max-width: var(--page-max-form);
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
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.section-optional {
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
		opacity: 0.65;
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

	.info-icon {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		font-size: 0.65rem;
		border-radius: 50%;
		border: 1px solid var(--border);
		color: var(--text-muted);
		cursor: default;
		flex-shrink: 0;
		user-select: none;
		vertical-align: middle;
	}

	.info-icon:hover {
		border-color: var(--text-muted);
		color: var(--text);
	}

	.info-icon .tooltip {
		display: none;
		position: absolute;
		left: 50%;
		bottom: calc(100% + 0.5rem);
		transform: translateX(-50%);
		width: 22rem;
		max-width: calc(100vw - 2rem);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.65rem 0.8rem;
		font-size: 0.78rem;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		line-height: 1.5;
		color: var(--text-muted);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
		pointer-events: none;
		z-index: 100;
		white-space: normal;
	}

	.info-icon .tooltip strong {
		color: var(--text);
		font-weight: 600;
	}

	.info-icon:hover .tooltip {
		display: block;
	}

	.field-error {
		font-size: 0.78rem;
		color: #ef4444;
	}

	.error {
		font-size: 0.85rem;
		color: #ef4444;
	}

	.submit-error {
		font-size: 0.875rem;
		color: #ef4444;
		background: color-mix(in srgb, #ef4444 8%, var(--surface));
		border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		line-height: 1.5;
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
