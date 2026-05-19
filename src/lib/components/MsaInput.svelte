<script lang="ts">
	import FileDropzone from '$lib/components/FileDropzone.svelte';

	const MMSEQS2_URL = 'https://api.colabfold.com';
	const POLL_INTERVAL_MS = 5000;
	const MAX_POLLS = 72; // 6 min

	interface Props {
		msaUrl?: string;        // AlphaFold: versioned EBI URL → auto-fetch
		chainSequence?: string; // PDB/custom: sequence to submit to MMSeqs2
		queryName?: string;     // label for the MMSeqs2 query (e.g. "3BIO_A")
		onLoaded: (content: string, filename: string) => void;
		onClear: () => void;
	}

	let { msaUrl, chainSequence, queryName = 'query', onLoaded, onClear }: Props = $props();

	type Stage = 'idle' | 'fetching' | 'submitting' | 'polling' | 'downloading' | 'done' | 'error';

	let stage  = $state<Stage>('idle');
	let status = $state('');            // human-readable progress label
	let error  = $state<string | null>(null);
	let loaded = $state<{ filename: string; lines: number; content: string } | null>(null);

	const afFilename = $derived(msaUrl ? (msaUrl.split('/').at(-1) ?? 'msa.a3m') : null);
	const busy = $derived(stage !== 'idle' && stage !== 'done' && stage !== 'error');

	// ── AlphaFold auto-fetch ─────────────────────────────────────────────────

	async function fetchAlphaFold() {
		if (!msaUrl) return;
		stage = 'fetching';
		error = null;
		status = 'Downloading from EBI…';
		try {
			const res = await fetch(msaUrl);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const content = await res.text();
			setLoaded(content, afFilename!);
		} catch (e) {
			setError(e);
		}
	}

	// ── MMSeqs2 (ColabFold) ──────────────────────────────────────────────────

	async function fetchMMSeqs2() {
		if (!chainSequence) return;
		stage = 'submitting';
		error = null;
		status = 'Submitting to MMSeqs2…';
		try {
			const name = queryName.trim().replace(/\s+/g, '_') || 'query';
			const submitRes = await fetch(`${MMSEQS2_URL}/ticket/msa`, {
				method: 'POST',
				body: new URLSearchParams({ q: `>${name}\n${chainSequence}\n`, mode: 'all' }),
			});
			if (!submitRes.ok) throw new Error(`Submit failed: HTTP ${submitRes.status}`);
			const submit = await submitRes.json();
			if (submit.status === 'ERROR' || submit.status === 'MAINTENANCE')
				throw new Error(`MMSeqs2: ${submit.status}`);

			await pollUntilDone(submit.id, name);
		} catch (e) {
			setError(e);
		}
	}

	async function pollUntilDone(jobId: string, name: string) {
		stage = 'polling';
		for (let i = 0; i < MAX_POLLS; i++) {
			const elapsed = i * (POLL_INTERVAL_MS / 1000);
			status = `MMSeqs2 running… ${elapsed}s`;
			await sleep(POLL_INTERVAL_MS);
			try {
				const res = await fetch(`${MMSEQS2_URL}/ticket/${jobId}`);
				if (!res.ok) continue;
				const data = await res.json();
				if (data.status === 'COMPLETE') {
					stage = 'downloading';
					status = 'Downloading MSA…';
					await downloadResult(jobId, name);
					return;
				}
				if (data.status === 'ERROR' || data.status === 'MAINTENANCE')
					throw new Error(`MMSeqs2 job failed: ${data.status}`);
			} catch (e) {
				if ((e as Error).message.startsWith('MMSeqs2')) throw e;
				// network hiccup — keep polling
			}
		}
		throw new Error('MMSeqs2 timeout: job did not complete in 6 minutes');
	}

	async function downloadResult(jobId: string, name: string) {
		const res = await fetch(`${MMSEQS2_URL}/result/download/${jobId}`);
		if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

		// Gunzip via DecompressionStream (Chrome 80+, Firefox 113+, Safari 16.4+)
		const ds = new DecompressionStream('gzip');
		const tarBuffer = await new Response(res.body!.pipeThrough(ds)).arrayBuffer();

		// Parse tar → collect .a3m files
		const files = parseTar(tarBuffer);

		// uniref.a3m is the primary MSA (no environmental seqs)
		const content = files.get('uniref.a3m');
		if (!content) throw new Error('uniref.a3m not found in MMSeqs2 archive');

		setLoaded(content, `${name}_mmseqs2.a3m`);
	}

	// ── Tar parser ───────────────────────────────────────────────────────────

	function parseTar(buffer: ArrayBuffer): Map<string, string> {
		const bytes = new Uint8Array(buffer);
		const dec = new TextDecoder();
		const files = new Map<string, string>();
		let offset = 0;

		while (offset + 512 <= bytes.length) {
			const name = dec.decode(bytes.subarray(offset, offset + 100)).replace(/\0/g, '').trim();
			if (!name) break;
			const sizeOctal = dec.decode(bytes.subarray(offset + 124, offset + 136)).replace(/\0/g, '').trim();
			const size = parseInt(sizeOctal, 8);
			offset += 512;
			if (name.endsWith('.a3m') && size > 0)
				files.set(name, dec.decode(bytes.subarray(offset, offset + size)));
			offset += Math.ceil(size / 512) * 512;
		}
		return files;
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	function setLoaded(content: string, filename: string) {
		loaded = { filename, lines: content.split('\n').length, content };
		stage = 'done';
		status = '';
		onLoaded(content, filename);
	}

	function download() {
		if (!loaded) return;
		const blob = new Blob([loaded.content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = loaded.filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function setError(e: unknown) {
		error = e instanceof Error ? e.message : 'Unknown error';
		stage = 'error';
		status = '';
	}

	function handleFile(content: string, filename: string) {
		error = null;
		setLoaded(content, filename);
	}

	function clear() {
		loaded = null;
		error = null;
		stage = 'idle';
		status = '';
		onClear();
	}

	function sleep(ms: number): Promise<void> {
		return new Promise((r) => setTimeout(r, ms));
	}
</script>

<div class="msa-input">
	{#if loaded}
		<div class="fetch-row">
			<div class="fetch-info">
				<span class="fetch-label">{loaded.filename}</span>
				<span class="fetch-sub">{loaded.lines.toLocaleString()} lines</span>
			</div>
			<div class="loaded-actions">
				<button class="action-btn" onclick={download} type="button">Download</button>
				<button class="action-btn action-btn--muted" onclick={clear} type="button">Remove</button>
			</div>
		</div>
	{:else}
		{#if msaUrl}
			<div class="fetch-row">
				<div class="fetch-info">
					<span class="fetch-label">AlphaFold MSA available</span>
					<span class="fetch-sub">{afFilename} · EBI</span>
				</div>
				<button class="action-btn" onclick={fetchAlphaFold} disabled={busy} type="button">
					{stage === 'fetching' ? status : 'Auto-fetch'}
				</button>
			</div>
		{:else if chainSequence}
			<div class="fetch-row">
				<div class="fetch-info">
					<span class="fetch-label">Compute MSA via MMSeqs2</span>
					<span class="fetch-sub">ColabFold API · ~1–3 min</span>
				</div>
				<button class="action-btn" onclick={fetchMMSeqs2} disabled={busy} type="button">
					{busy ? status : 'Fetch'}
				</button>
			</div>
		{/if}

		{#if error}
			<p class="fetch-error">{error}</p>
		{/if}

		{#if msaUrl || chainSequence}
			<div class="divider"><span>or upload your own</span></div>
		{/if}

		<FileDropzone
			accept=".fasta,.a3m,.fa"
			label="Drop your MSA file here"
			hint="browse (.fasta, .a3m)"
			onFile={handleFile}
		/>
	{/if}
</div>

<style>
	.msa-input {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.fetch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		padding: 0.75rem 0.875rem;
	}

	.fetch-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.fetch-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fetch-sub {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-family: monospace;
	}

	.loaded-actions {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.action-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.45rem 0.875rem;
		font-size: 0.82rem;
		color: var(--text);
		cursor: pointer;
		white-space: nowrap;
		transition: border-color 0.15s, color 0.15s;
		flex-shrink: 0;
	}

	.action-btn:hover:not(:disabled) {
		border-color: var(--text-muted);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn--muted {
		color: var(--text-muted);
	}

	.fetch-error {
		font-size: 0.8rem;
		color: #ef4444;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-size: 0.78rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}
</style>
