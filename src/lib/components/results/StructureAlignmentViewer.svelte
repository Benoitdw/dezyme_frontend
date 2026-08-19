<script lang="ts">
	import type { StructureAlignment, ColumnKind } from '$lib/utils/alignment';

	interface Props { alignment: StructureAlignment }
	let { alignment }: Props = $props();

	const KIND_LABEL: Record<ColumnKind, string> = {
		'match':      'identical',
		'mismatch':   'mismatch',
		'gap-struct': 'missing in structure',
		'gap-seq':    'missing in MSA',
	};

	// Width of one monospace character, measured once the font is applied: the
	// alignment is re-wrapped to whatever fits instead of the log's fixed 100.
	const PROBE = 'M'.repeat(100);
	let charW = $state(7.5);
	let seqW  = $state(0);
	let probe = $state<HTMLSpanElement | null>(null);
	let hoverCol = $state<number | null>(null);

	$effect(() => {
		seqW;  // re-measure whenever the layout changes
		const el = probe;
		if (!el) return;
		const measure = () => {
			const w = el.getBoundingClientRect().width / PROBE.length;
			if (w > 0) charW = w;
		};
		measure();
		// The monospace face may still be loading, which would shift every column
		document.fonts?.ready.then(measure).catch(() => {});
	});

	// Round down to a multiple of 10 so the ruler ticks stay on round numbers
	const perLine = $derived(Math.max(20, Math.floor((seqW - 1) / charW / 10) * 10) || 20);

	// Residue index on each side for every column (1-based, 0 on a gap)
	const indices = $derived.by(() => {
		const st = new Int32Array(alignment.length);
		const sq = new Int32Array(alignment.length);
		let s = 0, q = 0;
		for (let i = 0; i < alignment.length; i++) {
			const isStructGap = alignment.kinds[i] === 'gap-struct';
			const isSeqGap    = alignment.kinds[i] === 'gap-seq';
			st[i] = isStructGap ? 0 : ++s;
			sq[i] = isSeqGap    ? 0 : ++q;
		}
		return { st, sq };
	});

	interface Run { kind: ColumnKind; struct: string; mid: string; query: string }
	interface Row {
		start: number; end: number;
		structStart: number; structEnd: number;
		queryStart: number;  queryEnd: number;
		ticks: number[];
		runs: Run[];
	}

	const MID: Record<ColumnKind, string> = {
		'match': '|', 'mismatch': '·', 'gap-struct': ' ', 'gap-seq': ' ',
	};

	// Last residue index at or before column i, so a row that starts on a gap
	// still shows where it sits in each sequence.
	function lastIdx(arr: Int32Array, from: number, to: number): number {
		for (let i = to - 1; i >= from; i--) if (arr[i] > 0) return arr[i];
		return 0;
	}

	const rows = $derived.by((): Row[] => {
		const { kinds, structSeq, querySeq, length } = alignment;
		const out: Row[] = [];
		for (let start = 0; start < length; start += perLine) {
			const end = Math.min(start + perLine, length);

			const runs: Run[] = [];
			let runStart = start;
			for (let i = start; i <= end; i++) {
				if (i === end || kinds[i] !== kinds[runStart]) {
					runs.push({
						kind:   kinds[runStart],
						struct: structSeq.slice(runStart, i),
						query:  querySeq.slice(runStart, i),
						mid:    MID[kinds[runStart]].repeat(i - runStart),
					});
					runStart = i;
				}
			}

			const ticks: number[] = [];
			for (let i = start; i < end; i++) if ((i + 1) % 10 === 0) ticks.push(i);

			out.push({
				start, end,
				structStart: indices.st[start] || lastIdx(indices.st, 0, start),
				structEnd:   lastIdx(indices.st, start, end),
				queryStart:  indices.sq[start] || lastIdx(indices.sq, 0, start),
				queryEnd:    lastIdx(indices.sq, start, end),
				ticks,
				runs,
			});
		}
		return out;
	});

	const numCh = $derived(String(alignment.length).length + 1);

	function onRowMove(e: MouseEvent, row: Row) {
		const el = e.currentTarget as HTMLElement;
		const x = e.clientX - el.getBoundingClientRect().left;
		const col = row.start + Math.floor(x / charW);
		hoverCol = col >= row.start && col < row.end ? col : null;
	}

	const pct = (n: number) => `${((n / alignment.length) * 100).toFixed(alignment.length > 1000 ? 2 : 1)}%`;
</script>

<div class="aln" style="--num-ch: {numCh}ch">
	<div class="aln-head">
		<div class="chips">
			<span class="chip"><span class="chip-k">columns</span><span class="chip-v">{alignment.length}</span></span>
			<span class="chip"><span class="chip-k">identical</span><span class="chip-v">{alignment.matches} · {pct(alignment.matches)}</span></span>
			{#if alignment.mismatches > 0}
				<span class="chip mismatch"><span class="chip-k">mismatches</span><span class="chip-v">{alignment.mismatches}</span></span>
			{/if}
			{#if alignment.structGaps > 0}
				<span class="chip gap"><span class="chip-k">gaps in structure</span><span class="chip-v">{alignment.structGaps}</span></span>
			{/if}
			{#if alignment.queryGaps > 0}
				<span class="chip gap"><span class="chip-k">gaps in MSA</span><span class="chip-v">{alignment.queryGaps}</span></span>
			{/if}
		</div>
		<div class="readout" class:on={hoverCol !== null}>
			{#if hoverCol !== null}
				column <code>{hoverCol + 1}</code>
				· structure <code>{alignment.structSeq[hoverCol]}{indices.st[hoverCol] || ''}</code>
				· MSA <code>{alignment.querySeq[hoverCol]}{indices.sq[hoverCol] || ''}</code>
				· {KIND_LABEL[alignment.kinds[hoverCol]]}
			{:else}
				Hover the alignment for per-position detail
			{/if}
		</div>
	</div>

	<div class="aln-body">
		<!-- Mirrors a row's layout to report the width available for residues -->
		<div class="row gauge-row" aria-hidden="true">
			<span class="tag"></span><span class="num"></span>
			<div class="seqs" bind:clientWidth={seqW}>
				<div class="line measure"><span bind:this={probe}>{PROBE}</span></div>
			</div>
			<span class="num"></span>
		</div>

		{#each rows as row (row.start)}
			<div class="row">
				<span class="tag">
					<span class="tag-a">PDB</span>
					<span class="tag-b">MSA</span>
				</span>
				<span class="num">
					<span class="num-a">{row.structStart}</span>
					<span class="num-b">{row.queryStart}</span>
				</span>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="seqs" onmousemove={(e) => onRowMove(e, row)} onmouseleave={() => (hoverCol = null)}>
					<div class="ruler">
						{#each row.ticks as t (t)}
							<span class="tick" style="left: {(t - row.start + 1) * charW}px">{t + 1}</span>
						{/each}
					</div>
					<div class="line">{#each row.runs as run, i (i)}<span class={run.kind}>{run.struct}</span>{/each}</div>
					<div class="line mid">{#each row.runs as run, i (i)}<span class={run.kind}>{run.mid}</span>{/each}</div>
					<div class="line">{#each row.runs as run, i (i)}<span class={run.kind}>{run.query}</span>{/each}</div>
					{#if hoverCol !== null && hoverCol >= row.start && hoverCol < row.end}
						<div class="cursor" style="left: {(hoverCol - row.start) * charW}px; width: {charW}px"></div>
					{/if}
				</div>
				<span class="num right">
					<span class="num-a">{row.structEnd}</span>
					<span class="num-b">{row.queryEnd}</span>
				</span>
			</div>
		{/each}
	</div>

	<p class="aln-foot">
		Top line: residues of the modelled chain ({alignment.structLabel}). Bottom line: the MSA target
		sequence ({alignment.seqLabel}). Side numbers are residue indices in each sequence, the ruler counts
		alignment columns.
		{#if alignment.canonicalPositions}
			Canonical positions: <code>{alignment.canonicalPositions}</code>.
		{/if}
	</p>
</div>

<style>
	.aln { display: flex; flex-direction: column; gap: 0.75rem; --c-match: var(--text); --c-mismatch: #d97706; --c-gap: #ef4444; }
	:global(:root[data-theme='dark']) .aln { --c-mismatch: #fbbf24; --c-gap: #f87171; }

	.aln-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; }
	.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.chip { display: inline-flex; align-items: baseline; gap: 0.4rem; border: 1px solid var(--border); border-radius: 0.4rem; padding: 0.15rem 0.5rem; font-size: 0.72rem; }
	.chip-k { color: var(--text-muted); }
	.chip-v { font-family: monospace; color: var(--text); }
	.chip.mismatch { border-color: color-mix(in srgb, var(--c-mismatch) 45%, transparent); }
	.chip.mismatch .chip-v { color: var(--c-mismatch); }
	.chip.gap { border-color: color-mix(in srgb, var(--c-gap) 45%, transparent); }
	.chip.gap .chip-v { color: var(--c-gap); }

	.readout { font-size: 0.72rem; color: var(--text-muted); opacity: 0.65; }
	.readout.on { opacity: 1; }
	.readout code { font-family: monospace; color: var(--text); }

	.aln-body { border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.9rem; background: color-mix(in srgb, var(--text) 2%, transparent); }

	.row { display: flex; align-items: stretch; gap: 0.5rem; }
	.gauge-row { height: 0; overflow: hidden; margin: 0; padding: 0; }
	/* Sits inside a .line so it is measured with exactly the font the residues use */
	.line.measure { position: absolute; top: 0; left: 0; visibility: hidden; pointer-events: none; }

	.tag, .num { display: flex; flex-direction: column; justify-content: flex-end; gap: 0; font-family: monospace; font-size: 0.62rem; color: var(--text-muted); flex-shrink: 0; padding-top: 0.85rem; }
	.tag { width: 2.1rem; }
	.num { width: var(--num-ch); text-align: right; }
	.num.right { text-align: left; }
	.tag-a, .num-a { line-height: 1.35; }
	.tag-b, .num-b { line-height: 1.35; margin-top: 1.35em; }  /* skip the match line */

	.seqs { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden; padding-top: 0.85rem; }
	.ruler { position: absolute; top: 0; left: 0; right: 0; height: 0.85rem; }
	.tick { position: absolute; transform: translateX(-100%); font-family: monospace; font-size: 0.6rem; color: var(--text-muted); opacity: 0.7; }

	.line { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.72rem; line-height: 1.35; white-space: pre; color: var(--c-match); }
	.line.mid { color: var(--text-muted); opacity: 0.5; }

	.line .mismatch { color: var(--c-mismatch); background: color-mix(in srgb, var(--c-mismatch) 18%, transparent); border-radius: 2px; }
	.line .gap-struct, .line .gap-seq { color: var(--c-gap); background: color-mix(in srgb, var(--c-gap) 14%, transparent); border-radius: 2px; }
	.line.mid .mismatch, .line.mid .gap-struct, .line.mid .gap-seq { background: none; }

	.cursor { position: absolute; top: 0.85rem; bottom: 0; background: color-mix(in srgb, var(--text) 12%, transparent); pointer-events: none; }

	.aln-foot { margin: 0; font-size: 0.72rem; line-height: 1.55; color: var(--text-muted); }
	.aln-foot code { font-family: monospace; }
</style>
