<script lang="ts">
	import { detectInputType, fetchPdbMetadata, parsePdbFile } from '$lib/utils/pdb';
	import type { PdbMetadata } from '$lib/utils/pdb';

	interface Props {
		onLoaded: (meta: PdbMetadata, rawContent?: string) => void;
		onError: (msg: string) => void;
		onBiologicalAssembly?: (index: number | null) => void;
	}

	let { onLoaded, onError, onBiologicalAssembly }: Props = $props();

	let inputValue = $state('3BIO');
	let detectedType = $derived(inputValue.trim().length >= 4 ? detectInputType(inputValue) : null);
	let loading = $state(false);
	let dragging = $state(false);
	let loadedMeta = $state<PdbMetadata | null>(null);
	let baseMeta = $state<PdbMetadata | null>(null);  // asymmetric unit (original fetch)
	let selectedAssembly = $state<number | null>(null);  // null = asymmetric unit
	let assemblyLoading = $state(false);

	const typeLabel: Record<string, string> = {
		'pdb-id': 'PDB ID detected',
		uniprot: 'UniProt ID detected → AlphaFold',
		unknown: 'Unknown format'
	};

	async function fetchStructure() {
		if (!detectedType || detectedType === 'unknown') return;
		loading = true;
		loadedMeta = null;
		selectedAssembly = null;
		onBiologicalAssembly?.(null);
		try {
			const meta = await fetchPdbMetadata(inputValue.trim(), detectedType);
			loadedMeta = meta;
			baseMeta = meta;
			onLoaded(meta);
		} catch (e) {
			onError(e instanceof Error ? e.message : 'Failed to fetch structure');
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') fetchStructure();
	}

	function handleFile(file: File) {
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			try {
				const meta = parsePdbFile(content, file.name);
				loadedMeta = meta;
				selectedAssembly = null;
				onBiologicalAssembly?.(null);
				onLoaded(meta, content);
			} catch {
				onError('Failed to parse PDB file');
			}
		};
		reader.readAsText(file);
	}

	async function selectAssembly(index: number | null) {
		selectedAssembly = index;
		onBiologicalAssembly?.(index);

		if (!baseMeta) return;

		if (index === null) {
			// Restore asymmetric unit
			loadedMeta = baseMeta;
			onLoaded(baseMeta);
			return;
		}

		// Fetch the biological assembly PDB (e.g. 4HTC.pdb1)
		const id = baseMeta.id.toUpperCase();
		const filename = `${id}.pdb${index}`;
		const url = `https://files.rcsb.org/download/${filename}`;
		assemblyLoading = true;
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Assembly ${index} not available`);
			const content = await res.text();
			const assemblyMeta: PdbMetadata = { ...baseMeta, pdbContent: content, pdbFilename: filename };
			loadedMeta = assemblyMeta;
			onLoaded(assemblyMeta);
		} catch (e) {
			onError(e instanceof Error ? e.message : `Failed to fetch assembly ${index}`);
			selectedAssembly = null;
			onBiologicalAssembly?.(null);
		} finally {
			assemblyLoading = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function handleFileInput(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) handleFile(file);
	}
</script>

<div class="pdb-input">
	<div class="text-row">
		<div class="input-wrap">
			<input
				type="text"
				placeholder="3BIO or P12345 or paste ID..."
				bind:value={inputValue}
				onkeydown={handleKeydown}
				class="text-input"
				disabled={loading}
			/>
			{#if detectedType}
				<span class="type-hint" class:unknown={detectedType === 'unknown'}>
					{typeLabel[detectedType]}
				</span>
			{/if}
		</div>
		<button
			class="fetch-btn"
			onclick={fetchStructure}
			disabled={loading || !detectedType || detectedType === 'unknown'}
		>
			{loading ? 'Loading...' : 'Fetch'}
		</button>
	</div>

	{#if loadedMeta?.biologicalAssemblyCount}
		<div class="bio-unit-row">
			<div class="bio-unit-header">
				<span class="bio-unit-label">Biological unit</span>
				<span class="info-icon">ℹ<span class="tooltip">
					X-ray structures are deposited as an <strong>asymmetric unit</strong>, which may contain
					multiple copies or only part of the functional complex. <strong>Biological assemblies</strong>
					are the author-defined functional form. Chain selection always reflects the asymmetric unit;
					the chosen unit is what gets sent for score computation.
				</span></span>
			</div>
			<div class="bio-unit-options">
				<button
					class="unit-btn"
					class:active={selectedAssembly === null}
					onclick={() => selectAssembly(null)}
					type="button"
				>Asymmetric unit</button>
				{#each Array.from({ length: loadedMeta.biologicalAssemblyCount }, (_, i) => i + 1) as i}
					<button
						class="unit-btn"
						class:active={selectedAssembly === i}
						onclick={() => selectAssembly(i)}
						disabled={assemblyLoading}
						type="button"
					>{assemblyLoading && selectedAssembly === i ? '…' : `Assembly ${i}`}</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="divider"><span>or</span></div>

	<label
		class="dropzone"
		class:dragging
		ondragover={(e) => { e.preventDefault(); dragging = true; }}
		ondragleave={() => { dragging = false; }}
		ondrop={handleDrop}
	>
		<input type="file" onchange={handleFileInput} class="file-input" />
		<span class="drop-text">Drop your PDB file here</span>
		<span class="browse-hint"><code>.pdb</code> or biological unit (<code>.pdb1</code>, <code>.pdb2</code>, …) &nbsp;·&nbsp; <u>browse</u></span>
	</label>
</div>

<style>
	.pdb-input {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.text-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.input-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.text-input {
		width: 100%;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.6rem 0.875rem;
		font-size: 0.9rem;
		color: var(--text);
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.text-input:focus {
		border-color: var(--text-muted);
	}

	.type-hint {
		font-size: 0.75rem;
		color: var(--text-muted);
		padding-left: 0.25rem;
	}

	.type-hint.unknown {
		color: #ef4444;
	}

	.fetch-btn {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.6rem 1rem;
		font-size: 0.9rem;
		color: var(--text);
		cursor: pointer;
		white-space: nowrap;
		transition: border-color 0.15s;
	}

	.fetch-btn:hover:not(:disabled) {
		border-color: var(--text-muted);
	}

	.fetch-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.dropzone {
		border: 2px dashed var(--border);
		border-radius: 0.75rem;
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dropzone:hover,
	.dropzone.dragging {
		border-color: var(--text-muted);
		background: var(--surface);
	}

	.file-input {
		display: none;
	}

	.drop-text {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.browse-hint {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.bio-unit-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.bio-unit-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.bio-unit-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
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

	.bio-unit-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.unit-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.35rem 0.75rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
		white-space: nowrap;
	}

	.unit-btn:hover {
		border-color: var(--text-muted);
		color: var(--text);
	}

	.unit-btn.active {
		border-color: var(--text-muted);
		color: var(--text);
		background: var(--surface);
		font-weight: 600;
	}
</style>
