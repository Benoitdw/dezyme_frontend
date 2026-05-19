<script lang="ts">
	const PAD = { top: 20, right: 105, bottom: 48, left: 62 };
	const CW  = 720;
	const CH  = 360;
	const PW  = CW - PAD.left - PAD.right;
	const PH  = CH - PAD.top  - PAD.bottom;

	const STOPS: Array<[number, [number, number, number]]> = [
		[0.00, [215,  48,  39]],
		[0.40, [253, 174,  97]],
		[0.65, [ 26, 198, 198]],
		[1.00, [ 69,  52, 179]],
	];

	interface Row { identity: number; start: number; end: number; seq: string }
	interface Computed { rows: Row[]; coverage: Float32Array; L: number; N: number; maxCov: number }
	interface HoverInfo { cssX: number; cssY: number; pos: number; cov: number; covPct: number }

	interface Props { msaContent: string }
	let { msaContent }: Props = $props();

	let heatmapCanvas = $state<HTMLCanvasElement | null>(null);
	let overlayCanvas  = $state<HTMLCanvasElement | null>(null);
	let wrapper        = $state<HTMLDivElement | null>(null);

	let computing = $state(false);
	let error     = $state<string | null>(null);
	let stats     = $state<{ seqs: number; length: number } | null>(null);
	let hover     = $state<HoverInfo | null>(null);
	let isZoomed  = $state(false);

	let data: Computed | null = null;
	let viewStart = 0;
	let viewEnd   = 0;

	let isDragging   = false;
	let dragStartX   = 0;
	let dragViewStart = 0;

	// ── Color ────────────────────────────────────────────────────────────────

	function idColor(t: number): [number, number, number] {
		for (let i = 0; i < STOPS.length - 1; i++) {
			const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1];
			if (t <= t1) {
				const f = (t - t0) / (t1 - t0);
				return [
					Math.round(c0[0] + f * (c1[0] - c0[0])),
					Math.round(c0[1] + f * (c1[1] - c0[1])),
					Math.round(c0[2] + f * (c1[2] - c0[2])),
				];
			}
		}
		return STOPS[STOPS.length - 1][1];
	}

	// ── Parsing ───────────────────────────────────────────────────────────────

	function parseA3M(content: string): string[] {
		const seqs: string[] = [];
		let cur = '', inSeq = false;
		for (const line of content.split('\n')) {
			const l = line.trim();
			if (!l) continue;
			if (l.startsWith('>')) {
				if (inSeq && cur) seqs.push(cur.replace(/[a-z]/g, ''));
				cur = ''; inSeq = true;
			} else if (inSeq) cur += l;
		}
		if (inSeq && cur) seqs.push(cur.replace(/[a-z]/g, ''));
		return seqs;
	}

	function computeIdentity(query: string, seq: string): number {
		let matches = 0, total = 0;
		const len = Math.min(query.length, seq.length);
		for (let i = 0; i < len; i++) {
			if (query[i] === '-') continue;
			total++;
			if (query[i] === seq[i]) matches++;
		}
		return total > 0 ? matches / total : 0;
	}

	function sampleIndices(n: number, max: number): number[] {
		if (n <= max) return Array.from({ length: n }, (_, i) => i);
		return Array.from({ length: max }, (_, i) => Math.round((i * (n - 1)) / (max - 1)));
	}

	// ── Compute ───────────────────────────────────────────────────────────────

	function computeData(content: string): Computed {
		const allSeqs = parseA3M(content);
		if (allSeqs.length < 2) throw new Error('MSA needs at least 2 sequences');
		const query = allSeqs[0];
		const L = query.length;

		const rows: Row[] = allSeqs.slice(1).map((seq) => {
			const identity = computeIdentity(query, seq);
			let start = -1, end = -1;
			for (let i = 0; i < Math.min(L, seq.length); i++) {
				if (seq[i] !== '-') { if (start === -1) start = i; end = i; }
			}
			return { identity, start: Math.max(0, start), end, seq };
		});

		rows.sort((a, b) => (a.end - a.start) - (b.end - b.start));

		const coverage = new Float32Array(L);
		for (const row of rows) {
			for (let j = row.start; j <= row.end && j < Math.min(row.seq.length, L); j++) {
				if (row.seq[j] !== '-') coverage[j]++;
			}
		}
		const maxCov = Math.max(...coverage);

		return { rows, coverage, L, N: rows.length, maxCov };
	}

	// ── Heatmap render ────────────────────────────────────────────────────────

	function renderHeatmap() {
		if (!heatmapCanvas || !data) return;
		const ctx = heatmapCanvas.getContext('2d')!;
		const { rows, coverage, L, N, maxCov } = data;
		const vStart = viewStart, vEnd = viewEnd, vW = vEnd - vStart;

		// Sample rows to canvas height
		const sampledRows = sampleIndices(N, PH).map((i) => rows[i]);
		const R = sampledRows.length;

		// ImageData for heatmap
		const imgData = ctx.createImageData(PW, PH);
		const px = imgData.data;
		for (let i = 0; i < px.length; i += 4) { px[i] = px[i+1] = px[i+2] = 255; px[i+3] = 255; }

		for (let r = 0; r < R; r++) {
			const row = sampledRows[r];
			if (row.start < 0 || row.end < 0) continue;
			const [cr, cg, cb] = idColor(row.identity);
			const pyTop    = PH - 1 - Math.floor((r / R) * PH);
			const pyBottom = PH     - Math.floor((r / R) * PH);

			const seqStart = Math.max(row.start, vStart);
			const seqEnd   = Math.min(row.end, vEnd - 1, row.seq.length - 1);
			for (let j = seqStart; j <= seqEnd; j++) {
				if (row.seq[j] === '-') continue;
				const x = Math.floor(((j - vStart) / vW) * PW);
				if (x < 0 || x >= PW) continue;
				for (let y = pyTop; y < pyBottom && y < PH; y++) {
					const idx = (y * PW + x) * 4;
					px[idx] = cr; px[idx+1] = cg; px[idx+2] = cb; px[idx+3] = 255;
				}
			}
		}

		ctx.clearRect(0, 0, CW, CH);
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, CW, CH);
		ctx.putImageData(imgData, PAD.left, PAD.top);

		// Coverage line (visible window only)
		ctx.beginPath();
		ctx.strokeStyle = '#111';
		ctx.lineWidth = 1.5;
		for (let j = vStart; j < vEnd; j++) {
			const x = PAD.left + ((j - vStart) / vW) * PW;
			const y = PAD.top  + PH - (coverage[j] / maxCov) * PH;
			if (j === vStart) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		}
		ctx.stroke();

		drawAxes(ctx, L, N, maxCov);
		drawColorbar(ctx);
	}

	// ── Overlay (crosshair) ───────────────────────────────────────────────────

	function renderOverlay() {
		if (!overlayCanvas) return;
		const ctx = overlayCanvas.getContext('2d')!;
		ctx.clearRect(0, 0, CW, CH);
		if (!hover) return;

		const vW = viewEnd - viewStart;
		const x = PAD.left + ((hover.pos - viewStart) / vW) * PW;

		ctx.strokeStyle = 'rgba(0,0,0,0.45)';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 3]);
		ctx.beginPath();
		ctx.moveTo(x, PAD.top);
		ctx.lineTo(x, PAD.top + PH);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// ── Axes & colorbar ───────────────────────────────────────────────────────

	function drawAxes(ctx: CanvasRenderingContext2D, L: number, N: number, _maxCov: number) {
		const tc = '#666';
		ctx.font = '11px system-ui, sans-serif';

		// Border
		ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
		ctx.strokeRect(PAD.left, PAD.top, PW, PH);

		// X label
		ctx.fillStyle = tc; ctx.textAlign = 'center';
		ctx.font = '12px system-ui, sans-serif';
		ctx.fillText('Positions', PAD.left + PW / 2, CH - 6);

		// X ticks (show absolute positions in current view)
		ctx.font = '10px system-ui, sans-serif';
		const vW = viewEnd - viewStart;
		const xTicks = 8;
		for (let i = 0; i <= xTicks; i++) {
			const dataPos = viewStart + Math.round((i / xTicks) * vW);
			const x = PAD.left + (i / xTicks) * PW;
			ctx.fillStyle = tc;
			ctx.fillText(String(dataPos), x, PAD.top + PH + 16);
			ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.5;
			ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + PH); ctx.stroke();
		}

		// Y label
		ctx.save();
		ctx.translate(13, PAD.top + PH / 2);
		ctx.rotate(-Math.PI / 2);
		ctx.textAlign = 'center'; ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = tc;
		ctx.fillText('Sequences', 0, 0);
		ctx.restore();

		// Y ticks
		ctx.textAlign = 'right'; ctx.font = '10px system-ui, sans-serif';
		for (let i = 0; i <= 5; i++) {
			const val = Math.round((i / 5) * N);
			const y = PAD.top + PH - (i / 5) * PH;
			ctx.fillStyle = tc; ctx.fillText(String(val), PAD.left - 6, y + 4);
			ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.5;
			ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + PW, y); ctx.stroke();
		}
	}

	function drawColorbar(ctx: CanvasRenderingContext2D) {
		const cbX = CW - PAD.right + 18, cbW = 14, cbY = PAD.top, cbH = PH;
		const grad = ctx.createLinearGradient(0, cbY, 0, cbY + cbH);
		for (const [t, [r, g, b]] of STOPS) grad.addColorStop(1 - t, `rgb(${r},${g},${b})`);
		ctx.fillStyle = grad;
		ctx.fillRect(cbX, cbY, cbW, cbH);
		ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5;
		ctx.strokeRect(cbX, cbY, cbW, cbH);
		ctx.fillStyle = '#666'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'left';
		for (const v of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
			ctx.fillText(v.toFixed(1), cbX + cbW + 5, cbY + cbH - v * cbH + 3);
		}
		ctx.save();
		ctx.translate(CW - 10, cbY + cbH / 2);
		ctx.rotate(Math.PI / 2);
		ctx.textAlign = 'center'; ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#666';
		ctx.fillText('Sequence identity to query', 0, 0);
		ctx.restore();
	}

	// ── Mouse events ──────────────────────────────────────────────────────────

	function canvasX(e: MouseEvent): number {
		if (!overlayCanvas) return 0;
		const rect = overlayCanvas.getBoundingClientRect();
		return (e.clientX - rect.left) * (CW / rect.width);
	}

	function toCssX(e: MouseEvent): number {
		if (!overlayCanvas) return 0;
		return e.clientX - overlayCanvas.getBoundingClientRect().left;
	}

	function toCssY(e: MouseEvent): number {
		if (!overlayCanvas) return 0;
		return e.clientY - overlayCanvas.getBoundingClientRect().top;
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		if (!data) return;
		const { L } = data;
		const cx = canvasX(e) - PAD.left;
		if (cx < 0 || cx > PW) return;

		const frac = cx / PW;
		const vW = viewEnd - viewStart;
		const factor = e.deltaY > 0 ? 1.3 : 0.77;
		const newW = Math.min(L, Math.max(20, Math.round(vW * factor)));
		const anchor = viewStart + frac * vW;
		let newStart = Math.round(anchor - frac * newW);
		newStart = Math.max(0, Math.min(L - newW, newStart));
		viewStart = newStart;
		viewEnd   = newStart + newW;
		isZoomed  = newW < L;
		renderHeatmap();
		renderOverlay();
	}

	function onMouseDown(e: MouseEvent) {
		isDragging    = true;
		dragStartX    = e.clientX;
		dragViewStart = viewStart;
		e.preventDefault();
	}

	function onMouseMove(e: MouseEvent) {
		if (!data) return;
		const { L, coverage } = data;
		const cx = canvasX(e) - PAD.left;

		if (isDragging) {
			const rect = overlayCanvas!.getBoundingClientRect();
			const cssPerPos = rect.width / CW * PW / (viewEnd - viewStart);
			const posDelta = Math.round(-(e.clientX - dragStartX) / cssPerPos);
			const vW = viewEnd - viewStart;
			const newStart = Math.max(0, Math.min(L - vW, dragViewStart + posDelta));
			if (newStart !== viewStart) {
				viewStart = newStart;
				viewEnd   = newStart + vW;
				renderHeatmap();
			}
		}

		if (cx < 0 || cx > PW) { hover = null; renderOverlay(); return; }

		const vW = viewEnd - viewStart;
		const pos = Math.min(L - 1, Math.max(0, Math.round(viewStart + (cx / PW) * vW)));
		const cov = Math.round(coverage[pos] ?? 0);
		hover = { cssX: toCssX(e), cssY: toCssY(e), pos, cov, covPct: data.N > 0 ? (cov / data.N) * 100 : 0 };
		renderOverlay();
	}

	function onMouseUp() { isDragging = false; }

	function onMouseLeave() {
		isDragging = false;
		hover = null;
		renderOverlay();
	}

	function resetZoom() {
		if (!data) return;
		viewStart = 0;
		viewEnd   = data.L;
		isZoomed  = false;
		renderHeatmap();
	}

	// ── Init ──────────────────────────────────────────────────────────────────

	$effect(() => {
		if (!heatmapCanvas || !overlayCanvas || !msaContent) return;
		computing = true;
		error = null;
		setTimeout(() => {
			try {
				data = computeData(msaContent);
				viewStart = 0;
				viewEnd   = data.L;
				isZoomed  = false;
				stats = { seqs: data.N, length: data.L };
				renderHeatmap();
			} catch (e) {
				error = e instanceof Error ? e.message : 'Render error';
			} finally {
				computing = false;
			}
		}, 10);
	});
</script>

<div class="viewer" bind:this={wrapper}>
	{#if computing}
		<div class="overlay-msg">Computing…</div>
	{/if}
	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	<div class="canvas-wrap" style="width:{CW}px; height:{CH}px">
		<canvas bind:this={heatmapCanvas} width={CW} height={CH} class="canvas-layer"></canvas>
		<canvas
			bind:this={overlayCanvas}
			width={CW} height={CH}
			class="canvas-layer canvas-top"
			style="cursor: {isDragging ? 'grabbing' : 'crosshair'}"
			onwheel={onWheel}
			onmousedown={onMouseDown}
			onmousemove={onMouseMove}
			onmouseup={onMouseUp}
			onmouseleave={onMouseLeave}
		></canvas>

		{#if hover}
			{@const flip = hover.cssX > CW * 0.6}
			<div
				class="tooltip"
				style="
					left: {flip ? 'auto' : hover.cssX + 12}px;
					right: {flip ? CW - hover.cssX + 12 : 'auto'}px;
					top: {Math.min(hover.cssY + 8, CH - 56)}px;
				"
			>
				<span class="tt-row"><span class="tt-label">Position</span><span class="tt-val">{hover.pos}</span></span>
				<span class="tt-row"><span class="tt-label">Coverage</span><span class="tt-val">{hover.cov.toLocaleString()} seqs · {hover.covPct.toFixed(1)}%</span></span>
			</div>
		{/if}
	</div>

	<div class="footer">
		<p class="caption">
			Each horizontal line is a sequence colored by identity to the query (top).
			The black curve indicates coverage per position.
			{#if stats}
				<span class="caption-stats">{stats.seqs.toLocaleString()} sequences · {stats.length} positions</span>
			{/if}
		</p>
		{#if isZoomed}
			<button class="reset-btn" onclick={resetZoom} type="button">Reset zoom</button>
		{/if}
	</div>
</div>

<style>
	.viewer {
		position: relative;
		width: 100%;
		overflow-x: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.canvas-wrap {
		position: relative;
		max-width: 100%;
	}

	.canvas-layer {
		position: absolute;
		top: 0; left: 0;
		width: 100%; height: 100%;
		display: block;
	}

	.canvas-top {
		background: transparent;
	}

	.overlay-msg {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255,255,255,0.75);
		font-size: 0.875rem;
		color: var(--text-muted);
		z-index: 10;
	}

	.error-msg {
		font-size: 0.82rem;
		color: #ef4444;
		padding: 0.5rem 0;
	}

	.tooltip {
		position: absolute;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #ddd);
		border-radius: 0.4rem;
		padding: 0.35rem 0.6rem;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		z-index: 5;
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		min-width: 130px;
	}

	.tt-row {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.75rem;
	}

	.tt-label { color: var(--text-muted, #888); }
	.tt-val   { color: var(--text, #111); font-family: monospace; font-weight: 600; }

	.footer {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.5rem;
		width: min(720px, 100%);
	}

	.caption {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.5;
		flex: 1;
	}

	.caption-stats {
		display: block;
		font-family: monospace;
		margin-top: 0.1rem;
	}

	.reset-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.2rem 0.6rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		transition: border-color 0.15s, color 0.15s;
	}

	.reset-btn:hover {
		border-color: var(--text-muted);
		color: var(--text);
	}
</style>
