<script lang="ts">
	const AA3 = new Set([
		'ALA','ARG','ASN','ASP','CYS','GLN','GLU','GLY','HIS','ILE',
		'LEU','LYS','MET','PHE','PRO','SER','THR','TRP','TYR','VAL'
	]);

	const RESIDUE_RE = /^[A-Za-z]\d+$/;

	interface Row {
		id: number;
		residue: string;
		natural: string;
		mutant: string;
		naturalLocked: boolean;  // auto-filled from PDB
		naturalErr: string;
		mutantErr: string;
	}

	interface Props {
		residues?: Record<string, string>;
		onchange?: (mutations: string[] | null) => void;  // null = systematic
	}

	let { residues = {}, onchange }: Props = $props();

	let uid   = 0;
	let mode  = $state<'systematic' | 'custom'>('systematic');
	let rows  = $state<Row[]>([makeRow()]);

	function makeRow(): Row {
		return { id: uid++, residue: '', natural: '', mutant: '',
		         naturalLocked: false, naturalErr: '', mutantErr: '' };
	}

	function onResidueInput(row: Row) {
		row.residue = row.residue.toUpperCase();
		const found = residues?.[row.residue];
		if (found) {
			row.natural = found;
			row.naturalLocked = true;
			row.naturalErr = '';
		} else {
			row.naturalLocked = false;
		}
		emit();
	}

	function onNaturalInput(row: Row) {
		row.natural = row.natural.toUpperCase();
		row.naturalErr = row.natural && !AA3.has(row.natural) ? 'Unknown AA' : '';
		emit();
	}

	function onMutantInput(row: Row) {
		row.mutant = row.mutant.toUpperCase();
		row.mutantErr = row.mutant && !AA3.has(row.mutant) ? 'Unknown AA' : '';
		emit();
	}

	function addRow() {
		rows = [...rows, makeRow()];
	}

	function removeRow(id: number) {
		rows = rows.filter((r) => r.id !== id);
		emit();
	}

	function rowValid(r: Row): boolean {
		return RESIDUE_RE.test(r.residue) && AA3.has(r.natural) && AA3.has(r.mutant) && r.natural !== r.mutant;
	}

	function emit() {
		if (!onchange) return;
		if (mode === 'systematic') { onchange(null); return; }
		const valid = rows.filter(rowValid);
		// Format: A:ALA2VAL
		onchange(valid.map((r) => `${r.residue[0]}:${r.natural}${r.residue.slice(1)}${r.mutant}`));
	}

	function saveFile() {
		const lines = rows
			.filter((r) => r.residue || r.natural || r.mutant)
			.map((r) => `${r.residue} ${r.natural} ${r.mutant}`);
		if (!lines.length) return;
		const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'mutations.txt';
		a.click();
		URL.revokeObjectURL(url);
	}

	function loadFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';
		file.text().then((text) => {
			const newRows: Row[] = [];
			for (const raw of text.split('\n')) {
				const line = raw.trim();
				if (!line || line.startsWith('#')) continue;
				// Support "A2 ALA VAL" or "A:ALA2VAL"
				const standard = line.match(/^([A-Za-z]):([A-Za-z]{3})(\d+)([A-Za-z]{3})$/);
				if (standard) {
					const r = makeRow();
					r.residue = `${standard[1].toUpperCase()}${standard[3]}`;
					r.natural = standard[2].toUpperCase();
					r.mutant  = standard[4].toUpperCase();
					newRows.push(r);
					continue;
				}
				const cols = line.split(/[\s,\t]+/);
				if (cols.length >= 3) {
					const r = makeRow();
					r.residue = cols[0].toUpperCase();
					r.natural = cols[1].toUpperCase();
					r.mutant  = cols[2].toUpperCase();
					const found = residues[r.residue];
					if (found) { r.natural = found; r.naturalLocked = true; }
					newRows.push(r);
				}
			}
			if (newRows.length) rows = [...rows.filter((r) => r.residue), ...newRows];
			emit();
		});
	}

	$effect(() => {
		void mode;
		emit();
	});
</script>

<div class="mutation-wrap">
	<!-- Mode tabs -->
	<div class="mode-tabs">
		<button
			class="mode-tab"
			class:active={mode === 'systematic'}
			onclick={() => (mode = 'systematic')}
			type="button"
		>Systematic</button>
		<button
			class="mode-tab"
			class:active={mode === 'custom'}
			onclick={() => (mode = 'custom')}
			type="button"
		>Custom list</button>
	</div>

	{#if mode === 'systematic'}
		<p class="sys-hint">All single-point mutations will be computed.</p>
	{:else}
		<div class="table-wrap">
			<div class="trow theader">
				<span>Residue</span>
				<span>WT</span>
				<span>Mutant</span>
				<span></span>
			</div>
			{#each rows as row (row.id)}
				<div class="trow">
					<div class="tcell">
						<input
							class="tinput"
							type="text"
							maxlength="6"
							placeholder="A2"
							bind:value={row.residue}
							oninput={() => onResidueInput(row)}
						/>
					</div>
					<div class="tcell">
						<input
							class="tinput"
							class:locked={row.naturalLocked}
							class:err={row.naturalErr}
							type="text"
							maxlength="3"
							placeholder="ALA"
							bind:value={row.natural}
							readonly={row.naturalLocked}
							oninput={() => onNaturalInput(row)}
						/>
						{#if row.naturalErr}<span class="cell-err">{row.naturalErr}</span>{/if}
					</div>
					<div class="tcell">
						<input
							class="tinput"
							class:err={row.mutantErr}
							type="text"
							maxlength="3"
							placeholder="VAL"
							bind:value={row.mutant}
							oninput={() => onMutantInput(row)}
						/>
						{#if row.mutantErr}<span class="cell-err">{row.mutantErr}</span>{/if}
					</div>
					<button class="del-btn" onclick={() => removeRow(row.id)} type="button" aria-label="Remove">×</button>
				</div>
			{/each}
		</div>

		<div class="list-actions">
			<button class="action-btn" onclick={addRow} type="button">+ Add</button>
			<label class="action-btn file-label">
				↑ Load
				<input type="file" accept=".txt,.csv,.tsv" onchange={loadFile} style="display:none" />
			</label>
			<button
				class="action-btn"
				onclick={saveFile}
				type="button"
				disabled={!rows.some((r) => r.residue || r.natural || r.mutant)}
			>↓ Save</button>
		</div>
		<p class="format-hint">
			File format: one mutation per line — <code>A2 ALA VAL</code> or <code>A:ALA2VAL</code>
		</p>
	{/if}
</div>

<style>
	.mutation-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Mode tabs */
	.mode-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		padding: 0.2rem;
		width: fit-content;
	}

	.mode-tab {
		background: none;
		border: none;
		border-radius: 0.4rem;
		padding: 0.35rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.mode-tab.active {
		background: var(--surface);
		color: var(--text);
		font-weight: 600;
	}

	.sys-hint {
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	/* Table */
	.table-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.trow {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 28px;
		gap: 0.4rem;
		align-items: start;
	}

	.theader {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		padding-bottom: 0.15rem;
		align-items: center;
	}

	.tcell {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.tinput {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.38rem 0.6rem;
		font-size: 0.85rem;
		font-family: monospace;
		color: var(--text);
		width: 100%;
		transition: border-color 0.15s;
	}

	.tinput:focus {
		outline: none;
		border-color: var(--text-muted);
	}

	.tinput.locked {
		background: color-mix(in srgb, #34d399 8%, var(--bg));
		border-color: color-mix(in srgb, #34d399 30%, transparent);
		color: #34d399;
	}

	.tinput.err {
		border-color: #ef4444;
	}

	.cell-err {
		font-size: 0.7rem;
		color: #ef4444;
	}

	.del-btn {
		background: none;
		border: none;
		font-size: 1rem;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.35rem 0.2rem;
		line-height: 1;
		transition: color 0.15s;
		margin-top: 2px;
	}

	.del-btn:hover { color: #ef4444; }

	/* Actions */
	.list-actions {
		display: flex;
		gap: 0.5rem;
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
		transition: color 0.15s, border-color 0.15s;
	}

	.action-btn:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.file-label { cursor: pointer; }

	.format-hint {
		font-size: 0.75rem;
		color: var(--text-muted);
		opacity: 0.7;
	}

	.format-hint code {
		font-family: monospace;
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		padding: 0.05rem 0.3rem;
		border-radius: 0.2rem;
	}
</style>
