<script lang="ts">
	import { detectInputType, fetchPdbMetadata, parsePdbFile } from '$lib/utils/pdb';
	import type { PdbMetadata } from '$lib/utils/pdb';

	interface Props {
		onLoaded: (meta: PdbMetadata, rawContent?: string) => void;
		onError: (msg: string) => void;
	}

	let { onLoaded, onError }: Props = $props();

	let inputValue = $state('');
	let detectedType = $derived(inputValue.trim().length >= 4 ? detectInputType(inputValue) : null);
	let loading = $state(false);
	let dragging = $state(false);

	const typeLabel: Record<string, string> = {
		'pdb-id': 'PDB ID detected',
		uniprot: 'UniProt ID detected → AlphaFold',
		unknown: 'Unknown format'
	};

	async function fetchStructure() {
		if (!detectedType || detectedType === 'unknown') return;
		loading = true;
		try {
			const meta = await fetchPdbMetadata(inputValue.trim(), detectedType);
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
				const meta = parsePdbFile(content);
				onLoaded(meta, content);
			} catch {
				onError('Failed to parse PDB file');
			}
		};
		reader.readAsText(file);
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
				placeholder="4ABC or P12345 or paste ID..."
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

	<div class="divider"><span>or</span></div>

	<label
		class="dropzone"
		class:dragging
		ondragover={(e) => { e.preventDefault(); dragging = true; }}
		ondragleave={() => { dragging = false; }}
		ondrop={handleDrop}
	>
		<input type="file" accept=".pdb" onchange={handleFileInput} class="file-input" />
		<span class="drop-text">Drop your PDB file here</span>
		<span class="browse-hint">or <u>browse</u></span>
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
</style>
