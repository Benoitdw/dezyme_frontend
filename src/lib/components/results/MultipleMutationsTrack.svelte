<script lang="ts">
	import type { PositionInfo, MultipleMutationRow } from '$lib/utils/popmusic';

	interface Props {
		positions: PositionInfo[];
		rows: MultipleMutationRow[];
		expandedKeys?: Set<string>;
		onToggle?: (key: string) => void;
	}

	let { positions, rows, expandedKeys = new Set(), onToggle }: Props = $props();

	const MIN_SPAN = 8;        // never zoom past this many residues
	const LETTER_MIN_PX = 9;   // px per residue needed before drawing sequence letters
	const TICK_TARGET_PX = 78; // desired spacing between axis ticks
	const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

	// `null` means "whole sequence" — keeps the view valid when positions change.
	let view = $state<{ s: number; e: number } | null>(null);
	let trackW = $state(900);
	let axisEl = $state<HTMLDivElement | undefined>();

	const n = $derived(positions.length);
	const vs = $derived(view ? Math.max(0, view.s) : 0);
	const ve = $derived(view ? Math.min(n, view.e) : n);
	const span = $derived(Math.max(1, ve - vs));
	const pxPerRes = $derived(trackW / span);
	const showLetters = $derived(pxPerRes >= LETTER_MIN_PX);

	const resIndex = $derived(new Map(positions.map((p, i) => [p.resNumPdb, i])));

	/** Residue indices currently in view — only built when letters are drawn. */
	const visibleIdx = $derived(
		showLetters ? Array.from({ length: ve - vs }, (_, k) => vs + k) : []
	);

	/** Percent offset of a residue index within the current view. */
	function pct(i: number): number {
		return ((i - vs) / span) * 100;
	}

	// ── Zoom / pan ────────────────────────────────────────────────────────────

	function setView(s: number, newSpan: number) {
		const clamped = Math.max(MIN_SPAN, Math.min(n, Math.round(newSpan)));
		if (clamped >= n) {
			view = null;
			return;
		}
		const start = Math.max(0, Math.min(n - clamped, Math.round(s)));
		view = { s: start, e: start + clamped };
	}

	function zoomBy(factor: number, anchorFrac = 0.5) {
		const newSpan = span * factor;
		const anchor = vs + span * anchorFrac;
		setView(anchor - newSpan * anchorFrac, newSpan);
	}

	function panBy(deltaRes: number) {
		if (!view) return;
		setView(view.s + deltaRes, span);
	}

	function reset() {
		view = null;
	}

	/** Anchor the zoom under the cursor, measured against the plot column. */
	function onWheel(e: WheelEvent) {
		if (!axisEl) return;
		e.preventDefault();
		const rect = axisEl.getBoundingClientRect();
		const frac = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
		zoomBy(e.deltaY > 0 ? 1.25 : 0.8, Math.max(0, Math.min(1, frac)));
	}

	const PAN_THRESHOLD = 3; // px before a press counts as a drag rather than a click

	let panLastX = 0;
	let panStartX = 0;
	let panning = $state(false);
	let didPan = false;

	function startPan(e: PointerEvent) {
		if (e.button !== 0 || !view) return; // nothing to pan at full zoom-out
		panLastX = e.clientX;
		panStartX = e.clientX;
		didPan = false;
		window.addEventListener('pointermove', onPanMove);
		window.addEventListener('pointerup', onPanEnd, { once: true });
	}

	function onPanMove(e: PointerEvent) {
		if (!didPan && Math.abs(e.clientX - panStartX) < PAN_THRESHOLD) return;
		didPan = true;
		panning = true;
		const dx = e.clientX - panLastX;
		panLastX = e.clientX;
		panBy(-dx / pxPerRes);
	}

	function onPanEnd() {
		window.removeEventListener('pointermove', onPanMove);
		panning = false;
		// `didPan` stays set so the click that follows a drag is swallowed;
		// the next press resets it.
	}

	function laneClick(key: string) {
		if (didPan) {
			didPan = false;
			return;
		}
		onToggle?.(key);
	}

	// ── Minimap ───────────────────────────────────────────────────────────────

	function jumpTo(e: PointerEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const frac = (e.clientX - rect.left) / rect.width;
		setView(frac * n - span / 2, span);
	}

	/** Distinct mutated residue indices, for the minimap density ticks. */
	const mutatedIdx = $derived.by(() => {
		const set = new Set<number>();
		for (const row of rows) {
			for (const site of row.sites) {
				const i = resIndex.get(site.resNumPdb);
				if (i !== undefined) set.add(i);
			}
		}
		return [...set];
	});

	// ── Lanes ─────────────────────────────────────────────────────────────────

	interface Lane {
		key: string;
		label: string;
		marks: { i: number; site: MultipleMutationRow['sites'][number] }[];
		from: number;
		to: number;
	}

	const lanes = $derived.by<Lane[]>(() =>
		rows.map((row) => {
			const marks = row.sites
				.map((site) => ({ i: resIndex.get(site.resNumPdb), site }))
				.filter((m): m is { i: number; site: (typeof row.sites)[number] } => m.i !== undefined)
				.sort((a, b) => a.i - b.i);
			return {
				key: row.mutation_pdb,
				label: row.mutation_pdb,
				marks,
				from: marks.length ? marks[0].i : 0,
				to: marks.length ? marks[marks.length - 1].i : 0
			};
		})
	);

	// ── Axis ticks ────────────────────────────────────────────────────────────

	const ticks = $derived.by(() => {
		const wanted = Math.max(2, Math.floor(trackW / TICK_TARGET_PX));
		const raw = span / wanted;
		const step = NICE_STEPS.find((s) => s >= raw) ?? NICE_STEPS[NICE_STEPS.length - 1];
		const out: { i: number; label: number }[] = [];
		for (let i = Math.ceil(vs / step) * step; i < ve; i += step) {
			if (i >= 0 && i < n) out.push({ i, label: positions[i].resNumPdb });
		}
		return out;
	});

	const viewLabel = $derived(
		n === 0
			? '—'
			: view
				? `${positions[vs].resNumPdb}–${positions[Math.min(ve, n) - 1].resNumPdb} / ${n} aa`
				: `1–${n} / ${n} aa`
	);
</script>

<div class="track-card">
	<div class="track-toolbar">
		<div class="zoom-group">
			<button class="zoom-btn" onclick={() => zoomBy(1.6)} disabled={!view} type="button" aria-label="Zoom out">−</button>
			<button class="zoom-btn" onclick={() => zoomBy(0.625)} disabled={span <= MIN_SPAN} type="button" aria-label="Zoom in">+</button>
			<button class="zoom-btn reset" onclick={reset} disabled={!view} type="button">↺ Reset</button>
		</div>
		<span class="track-view-label">{viewLabel}</span>
	</div>

	<!-- Wheel-zoom and drag-pan apply to the whole plot, not just the sequence bar. -->
	<div
		class="track-grid"
		class:panning
		role="presentation"
		onwheel={onWheel}
		onpointerdown={startPan}
	>
		<!-- Axis -->
		<span class="lane-label axis-label">Sequence</span>
		<div class="axis-col" bind:this={axisEl} bind:clientWidth={trackW}>
			<div class="axis-ticks">
				{#each ticks as t}
					<span class="axis-tick" style="left:{pct(t.i)}%">{t.label}</span>
				{/each}
			</div>
			<div class="seq-bar">
				{#each visibleIdx as i}
					<span class="seq-letter" style="left:{pct(i)}%;width:{100 / span}%">
						{positions[i]?.wtAa ?? ''}
					</span>
				{/each}
				{#each mutatedIdx as i}
					{#if i >= vs && i < ve}
						<span class="seq-mark" style="left:{pct(i)}%;width:{Math.max(100 / span, 0.25)}%"></span>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Lanes -->
		<div class="lanes-scroll">
			<div class="lanes-grid" class:with-letters={showLetters}>
				{#each lanes as lane}
					{@const isOn = expandedKeys.has(lane.key)}
					<button
						class="lane-label lane-btn"
						class:is-on={isOn}
						title={lane.label}
						onclick={() => laneClick(lane.key)}
						type="button">{lane.label}</button
					>
					<button
						class="lane-col"
						class:is-on={isOn}
						onclick={() => laneClick(lane.key)}
						type="button"
						aria-label="Toggle {lane.label}"
					>
						{#if lane.marks.length > 1}
							{@const l = Math.max(pct(lane.from), 0)}
							{@const r = Math.min(pct(lane.to), 100)}
							{#if r > 0 && l < 100}
								<span class="lane-span" style="left:{l}%;width:{Math.max(r - l, 0)}%"></span>
							{/if}
						{/if}
						{#each lane.marks as m}
							{#if m.i >= vs && m.i < ve}
								<span
									class="lane-dot"
									style="left:{pct(m.i)}%"
									title="{m.site.mutation_pdb} — RSA {m.site.RSA.toFixed(1)}% · pLDDT {m.site.pLDDT.toFixed(1)}"
								></span>
								{#if showLetters}
									<span class="lane-mut" style="left:{pct(m.i)}%;width:{100 / span}%">{m.site.mutAa}</span>
								{/if}
							{/if}
						{/each}
					</button>
				{/each}
			</div>
		</div>

		<!-- Minimap -->
		<span class="lane-label minimap-label">Overview</span>
		<div
			class="minimap"
			role="presentation"
			onpointerdown={jumpTo}
		>
			{#each mutatedIdx as i}
				<span class="minimap-tick" style="left:{(i / Math.max(n, 1)) * 100}%"></span>
			{/each}
			<span
				class="minimap-window"
				style="left:{(vs / Math.max(n, 1)) * 100}%;width:{(span / Math.max(n, 1)) * 100}%"
			></span>
		</div>
	</div>

	<p class="track-hint">
		Scroll to zoom, drag to pan. Click a row to expand it in the table below.
		{#if !showLetters}
			Zoom in to reveal the sequence.
		{/if}
	</p>
</div>

<style>
	.track-card {
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		background: var(--surface);
		padding: 0.875rem 1rem 0.75rem;
		margin-bottom: 0.875rem;
	}

	.track-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.6rem;
	}

	.zoom-group { display: flex; gap: 0.3rem; }

	.zoom-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.35rem;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1;
		padding: 0.32rem 0.55rem;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}
	.zoom-btn:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }
	.zoom-btn:disabled { opacity: 0.4; cursor: default; }
	.zoom-btn.reset { font-size: 0.72rem; }

	.track-view-label {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.track-grid {
		display: grid;
		grid-template-columns: minmax(90px, 160px) 1fr;
		align-items: center;
		gap: 0.2rem 0.6rem;
		touch-action: pan-y;
	}
	.track-grid.panning { cursor: grabbing; }
	.track-grid.panning * { cursor: grabbing; }

	.lane-label {
		font-family: monospace;
		font-size: 0.72rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: right;
	}

	.axis-label, .minimap-label { font-family: inherit; font-weight: 600; }

	.axis-col { position: relative; }

	.axis-ticks { position: relative; height: 1rem; }

	.axis-tick {
		position: absolute;
		transform: translateX(-50%);
		font-family: monospace;
		font-size: 0.68rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.seq-bar {
		position: relative;
		height: 1.15rem;
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
		border-radius: 0.2rem;
		overflow: hidden;
		cursor: grab;
	}

	.seq-letter {
		position: absolute;
		top: 0;
		text-align: center;
		font-family: monospace;
		font-size: 0.68rem;
		line-height: 1.15rem;
		color: var(--text-muted);
		pointer-events: none;
	}

	.seq-mark {
		position: absolute;
		top: 0;
		bottom: 0;
		min-width: 2px;
		background: color-mix(in srgb, var(--accent) 55%, transparent);
		pointer-events: none;
	}

	/* Lanes span both grid columns, then re-establish the same two-column grid
	   so every lane stays aligned with the axis above. */
	.lanes-scroll {
		grid-column: 1 / -1;
		max-height: 11rem;
		overflow-y: auto;
		margin: 0.35rem 0;
	}

	.lanes-grid {
		display: grid;
		grid-template-columns: minmax(90px, 160px) 1fr;
		align-items: center;
		gap: 0.15rem 0.6rem;
	}

	.lane-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		transition: color 0.15s;
	}
	.lane-btn:hover { color: var(--text); }
	.lane-btn.is-on { color: var(--accent); font-weight: 700; }

	.lane-col {
		position: relative;
		height: 1.05rem;
		background: none;
		border: none;
		border-radius: 0.2rem;
		padding: 0;
		width: 100%;
		cursor: pointer;
		/* Marks outside the zoomed view keep an off-range offset — clip them so
		   they never spill over the label column. */
		overflow: hidden;
		transition: background 0.15s;
	}
	.lane-col:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
	.lane-col.is-on { background: color-mix(in srgb, var(--accent) 12%, transparent); }

	/* Taller lanes when the mutant letter is drawn, so it has room below the dot
	   instead of being clipped. */
	.with-letters .lane-col { height: 1.6rem; }

	.lane-span {
		position: absolute;
		top: 50%;
		height: 2px;
		transform: translateY(-50%);
		background: color-mix(in srgb, var(--accent) 45%, transparent);
		pointer-events: none;
	}
	.lane-col.is-on .lane-span { background: var(--accent); height: 3px; }
	.with-letters .lane-span { top: 0.5rem; }

	.lane-dot {
		position: absolute;
		top: 50%;
		width: 7px;
		height: 7px;
		margin-left: -3.5px;
		transform: translateY(-50%);
		border-radius: 50%;
		background: var(--accent);
	}
	.with-letters .lane-dot { top: 0.5rem; }
	.lane-col.is-on .lane-dot {
		width: 9px;
		height: 9px;
		margin-left: -4.5px;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	/* Only drawn when the sequence is legible; sits under the dot, inside the
	   lane's clipped box. */
	.lane-mut {
		position: absolute;
		bottom: 0;
		text-align: center;
		font-family: monospace;
		font-size: 0.62rem;
		font-weight: 700;
		line-height: 1;
		color: var(--accent);
		pointer-events: none;
	}

	.minimap {
		position: relative;
		height: 0.7rem;
		background: color-mix(in srgb, var(--text-muted) 10%, transparent);
		border-radius: 0.2rem;
		cursor: pointer;
		overflow: hidden;
		touch-action: none;
	}

	.minimap-tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: color-mix(in srgb, var(--accent) 50%, transparent);
	}

	.minimap-window {
		position: absolute;
		top: 0;
		bottom: 0;
		min-width: 3px;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		border-left: 1px solid var(--accent);
		border-right: 1px solid var(--accent);
	}

	.track-hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		opacity: 0.75;
		margin: 0.5rem 0 0;
	}
</style>
