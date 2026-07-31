<script lang="ts">
	interface Props {
		chain?: string;
		onchange?: (mutations: string[] | null, msaReference: boolean) => void;
	}

	let { chain, onchange }: Props = $props();

	// Tokens joined by ':' form one multiple mutation per line. The token format
	// depends on which column the CLI keys its mutations by: `mutation_pdb`
	// carries the chain ("MA1R"), `mutation_msa` does not ("M1R").
	const TOKEN_PDB_RE = /^([A-Z])([A-Za-z0-9])(\d+)([A-Z])$/;
	const TOKEN_MSA_RE = /^([A-Z])(\d+)([A-Z])$/;
	const MAX_WARNINGS = 6;

	const PLACEHOLDER_PDB = `MA1R:QA2A
KA15E
# lines starting with # are ignored`;

	const PLACEHOLDER_MSA = `M1R:Q2A
K15E
# lines starting with # are ignored`;

	interface Warning {
		line: number;
		message: string;
	}

	let text = $state('');
	let msaReference = $state(false);

	/** Lines the CLI would keep: non-empty, non-comment. */
	function contentLines(raw: string): { n: number; value: string }[] {
		return raw
			.split('\n')
			.map((value, i) => ({ n: i + 1, value: value.trim() }))
			.filter((l) => l.value !== '' && !l.value.startsWith('#'));
	}

	let mutations = $derived(contentLines(text).map((l) => l.value));

	// Warnings only — the job runs with --allow_invalid_mutations, so anything
	// that does not resolve is skipped rather than failing the analysis.
	let warnings = $derived.by(() => {
		const out: Warning[] = [];
		for (const { n, value } of contentLines(text)) {
			const positions = new Set<string>();
			for (const token of value.split(':')) {
				const m = (msaReference ? TOKEN_MSA_RE : TOKEN_PDB_RE).exec(token.toUpperCase());
				if (!m) {
					out.push({
						line: n,
						message: msaReference
							? `"${token}" is not <WT><position><mutant> — MSA numbering carries no chain`
							: `"${token}" is not <WT><chain><position><mutant>`
					});
					continue;
				}

				let key: string;
				if (msaReference) {
					key = m[2];
				} else {
					const [, , tokenChain, position] = m;
					key = `${tokenChain}${position}`;
					if (chain && tokenChain !== chain.toUpperCase()) {
						out.push({
							line: n,
							message: `"${token}" targets chain ${tokenChain}, but chain ${chain} is selected`
						});
					}
				}

				if (positions.has(key)) {
					out.push({ line: n, message: `position ${key} is mutated twice on this line` });
				}
				positions.add(key);
			}
		}
		return out;
	});

	function emit() {
		onchange?.(mutations.length ? mutations : null, msaReference);
	}

	function onInput(e: Event) {
		text = (e.currentTarget as HTMLTextAreaElement).value;
		emit();
	}

	function onMsaReferenceChange(e: Event) {
		msaReference = (e.currentTarget as HTMLInputElement).checked;
		emit();
	}

	function saveFile() {
		if (!text.trim()) return;
		const blob = new Blob([text.endsWith('\n') ? text : `${text}\n`], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'multiple_mutations.txt';
		a.click();
		URL.revokeObjectURL(url);
	}

	function loadFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';
		file.text().then((content) => {
			text = content.replace(/\r\n/g, '\n').replace(/\n+$/, '');
			emit();
		});
	}
</script>

<div class="mm-wrap">
	<textarea
		class="mm-input"
		rows="6"
		spellcheck="false"
		placeholder={msaReference ? PLACEHOLDER_MSA : PLACEHOLDER_PDB}
		value={text}
		oninput={onInput}
	></textarea>

	<div class="mm-actions">
		<label class="action-btn file-label">
			↑ Load
			<input type="file" accept=".txt,.csv,.tsv" onchange={loadFile} style="display:none" />
		</label>
		<button class="action-btn" onclick={saveFile} type="button" disabled={!text.trim()}>
			↓ Save
		</button>
		{#if mutations.length}
			<span class="mm-count">
				{mutations.length} multiple mutation{mutations.length > 1 ? 's' : ''}
			</span>
		{/if}
	</div>

	<label class="mm-toggle">
		<input type="checkbox" checked={msaReference} onchange={onMsaReferenceChange} />
		<span>Use MSA numbering as the mutation reference</span>
	</label>
	<p class="mm-hint mm-toggle-hint">
		Off: mutations refer to the PDB numbering. On: they refer to the aligned MSA positions
		(<code>--mutation_msa_reference</code>). <strong>This changes the expected format.</strong>
	</p>

	<p class="mm-hint">
		One multiple mutation per line — single mutations joined by <code>:</code>, with one-letter
		amino acids. Lines starting with <code>#</code> are ignored.
		{#if msaReference}
			MSA numbering carries no chain, so each mutation is written
			<code>&lt;WT&gt;&lt;position&gt;&lt;mutant&gt;</code> — e.g. <code>M1R:Q2A</code>.
		{:else}
			Each mutation is written
			<code>&lt;WT&gt;&lt;chain&gt;&lt;position&gt;&lt;mutant&gt;</code> — e.g. <code>MA1R:QA2A</code>.
		{/if}
	</p>

	{#if warnings.length}
		<ul class="mm-warnings">
			{#each warnings.slice(0, MAX_WARNINGS) as w}
				<li>Line {w.line}: {w.message}</li>
			{/each}
			{#if warnings.length > MAX_WARNINGS}
				<li class="mm-warn-more">+{warnings.length - MAX_WARNINGS} more</li>
			{/if}
		</ul>
	{/if}

	<p class="mm-info">
		ⓘ Mutations that cannot be resolved against the structure are skipped, not treated as errors —
		the analysis still runs.
	</p>
</div>

<style>
	.mm-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.mm-input {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.85rem;
		font-family: monospace;
		line-height: 1.5;
		color: var(--text);
		width: 100%;
		resize: vertical;
		transition: border-color 0.15s;
	}

	.mm-input:focus {
		outline: none;
		border-color: var(--text-muted);
	}

	.mm-input::placeholder {
		color: var(--text-muted);
		opacity: 0.5;
	}

	.mm-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.action-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.35rem 0.8rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.action-btn:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.file-label {
		cursor: pointer;
	}

	.mm-count {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.mm-toggle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		color: var(--text);
		cursor: pointer;
		width: fit-content;
	}

	.mm-toggle input {
		cursor: pointer;
	}

	.mm-hint {
		font-size: 0.75rem;
		color: var(--text-muted);
		opacity: 0.7;
		line-height: 1.5;
	}

	.mm-toggle-hint {
		margin-top: -0.35rem;
	}

	.mm-hint code {
		font-family: monospace;
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		padding: 0.05rem 0.3rem;
		border-radius: 0.2rem;
	}

	.mm-warnings {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.75rem;
		color: #f59e0b;
		padding: 0.5rem 0.7rem;
		border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
		background: color-mix(in srgb, #f59e0b 8%, transparent);
		border-radius: 0.4rem;
	}

	.mm-warn-more {
		opacity: 0.8;
	}

	.mm-info {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.5;
	}
</style>
