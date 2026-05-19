<script lang="ts" module>
	export interface HeatmapRowDef {
		label: string;
		values: (number | null)[];
		colorFn: (v: number, vmin: number, vmax: number, dark: boolean) => [number, number, number];
		vmin?: number;
		vmax?: number;
		rowHeight?: number;
		fmt?: (v: number) => string;
	}

	export interface ColorbarDef {
		label: string;
		vmin: number;
		vmax: number;
		colorFn: (v: number, vmin: number, vmax: number, dark: boolean) => [number, number, number];
		fmt?: (v: number) => string;
	}

	// ── Exported color functions ──────────────────────────────────────────────

	function lerp(a: number, b: number, t: number): number {
		return Math.round(a + (b - a) * t);
	}

	/** Diverging red → neutral → blue scale, centered at 0. */
	export function ddgColor(v: number, vmin: number, vmax: number, dark: boolean): [number, number, number] {
		const absMax = Math.max(Math.abs(vmin), Math.abs(vmax), 0.01);
		const t = Math.max(-1, Math.min(1, v / absMax));
		// neutral: near-white in light, near-surface in dark
		const neutral: [number, number, number] = dark ? [38, 42, 58] : [240, 240, 245];
		if (t >= 0) {
			return [lerp(neutral[0], 215, t), lerp(neutral[1], 50, t), lerp(neutral[2], 50, t)];
		}
		const s = -t;
		return [lerp(neutral[0], 35, s), lerp(neutral[1], 115, s), lerp(neutral[2], 210, s)];
	}

	/** Orange (buried) → teal (exposed) for RSA / accessibility. */
	export function rsaColor(v: number, _vmin: number, _vmax: number, _dark: boolean): [number, number, number] {
		const t = Math.max(0, Math.min(1, v / 100));
		return [lerp(210, 15, t), lerp(95, 175, t), lerp(35, 160, t)];
	}

	/** Blue (low) → red (high) for gap percentage. */
	export function gapColor(v: number, _vmin: number, _vmax: number, _dark: boolean): [number, number, number] {
		const t = Math.max(0, Math.min(1, v / 100));
		return [lerp(30, 215, t), lerp(130, 50, t), lerp(200, 50, t)];
	}
</script>

<script lang="ts">
	import { theme } from '$lib/stores/theme';

	interface Props {
		positions: string[];
		headerRows?: HeatmapRowDef[];
		dataRows: HeatmapRowDef[];
		colorbar?: ColorbarDef;
		/** Column indices that are structural gaps — rendered with a cross-hatch pattern. */
		gapIndices?: Set<number>;
	}

	let { positions, headerRows = [], dataRows, colorbar, gapIndices }: Props = $props();

	const HEADER_H = 26;
	const DATA_H   = 20;
	const SEP_GAP  = 8;
	const PAD_LEFT = 82;
	const PAD_TOP  = 12;
	const PAD_BOT  = 44;

	let container = $state<HTMLDivElement | null>(null);
	let canvas    = $state<HTMLCanvasElement | null>(null);
	let cw        = $state(900);
	let isZoomed  = $state(false);
	let isDragging = $state(false);
	let hover     = $state<{ cssX: number; cssY: number; posLabel: string; rowLabel: string; value: number | null; isGap: boolean } | null>(null);

	let viewStart     = 0;
	let viewEnd       = 0;
	let dragStartX    = 0;
	let dragViewStart = 0;

	const padRight = $derived(colorbar ? 90 : 20);

	const ch = $derived(
		PAD_TOP +
		headerRows.length * HEADER_H +
		(headerRows.length > 0 ? SEP_GAP : 0) +
		dataRows.length * DATA_H +
		PAD_BOT
	);

	// ── Row geometry ─────────────────────────────────────────────────────────

	type RowEntry = { def: HeatmapRowDef; y: number; h: number; vmin: number; vmax: number };

	function buildRows(): RowEntry[] {
		const out: RowEntry[] = [];
		let y = PAD_TOP;
		for (const def of headerRows) {
			const h = def.rowHeight ?? HEADER_H;
			const vals = def.values.filter((v): v is number => v !== null);
			const mn = vals.length ? Math.min(...vals) : 0;
			const mx = vals.length ? Math.max(...vals) : 1;
			out.push({ def, y, h, vmin: def.vmin ?? mn, vmax: def.vmax ?? (mx === mn ? mn + 1 : mx) });
			y += h;
		}
		if (headerRows.length > 0) y += SEP_GAP;
		for (const def of dataRows) {
			const h = def.rowHeight ?? DATA_H;
			const vals = def.values.filter((v): v is number => v !== null);
			const mn = vals.length ? Math.min(...vals) : 0;
			const mx = vals.length ? Math.max(...vals) : 1;
			out.push({ def, y, h, vmin: def.vmin ?? mn, vmax: def.vmax ?? (mx === mn ? mn + 1 : mx) });
			y += h;
		}
		return out;
	}

	function rowAtCssY(cssY: number, rows: RowEntry[]): RowEntry | null {
		for (const r of rows) if (cssY >= r.y && cssY < r.y + r.h) return r;
		return null;
	}

	// ── Drawing ───────────────────────────────────────────────────────────────

	function redraw() {
		if (!canvas || !positions.length) return;
		const ctx = canvas.getContext('2d')!;
		const W  = canvas.width;
		const H  = canvas.height;
		const PR = padRight;
		const PW = W - PAD_LEFT - PR;
		if (PW <= 0) return;

		const vW    = Math.max(1, viewEnd - viewStart);
		const cellW = PW / vW;
		const dark  = $theme === 'dark';

		const bgColor    = dark ? '#1c1e26' : '#ffffff';
		const mutedColor = dark ? '#94a3b8' : '#64748b';
		const borderClr  = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
		const sepClr     = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
		const tickClr    = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
		const nullColor  = dark ? '#141620' : '#eaecf0';

		// Background
		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, W, H);

		const rows = buildRows();
		const plotH = H - PAD_TOP - PAD_BOT;

		// Gap column overlay pattern (drawn once over the full column height)
		const gapFill = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
		const gapLine = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

		// Cells
		for (const { def, y, h, vmin, vmax } of rows) {
			for (let j = viewStart; j < viewEnd && j < positions.length; j++) {
				const isGap = gapIndices?.has(j) ?? false;
				const v = (!isGap && j < def.values.length) ? def.values[j] : null;
				const xF = PAD_LEFT + ((j - viewStart) / vW) * PW;
				const xW = PW / vW;
				const xi = Math.floor(xF);
				const xw = Math.max(1, Math.round(xF + xW) - xi);

				if (isGap) {
					ctx.fillStyle = gapFill;
				} else if (v === null) {
					ctx.fillStyle = nullColor;
				} else {
					const [r, g, b] = def.colorFn(v, vmin, vmax, dark);
					ctx.fillStyle = `rgb(${r},${g},${b})`;
				}
				// 1-px gap between rows for readability
				ctx.fillRect(xi, y, xw, h - 1);

				// Value text when cells are wide enough
				if (v !== null && cellW >= 32 && def.fmt) {
					const [r, g, b] = def.colorFn(v, vmin, vmax, dark);
					const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
					ctx.fillStyle = lum > 0.45 ? '#111' : '#eee';
					const fs = Math.min(10, Math.max(8, Math.floor(cellW * 0.28)));
					ctx.font = `${fs}px system-ui, sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					const txt = def.fmt(v);
					const tw = ctx.measureText(txt).width;
					if (tw < xw - 3) ctx.fillText(txt, xi + xw / 2, y + (h - 1) / 2);
				}
			}
		}

		// Gap column diagonal hatching (drawn over full plot height)
		if (gapIndices?.size) {
			ctx.save();
			ctx.strokeStyle = gapLine;
			ctx.lineWidth = 0.7;
			for (let j = viewStart; j < viewEnd && j < positions.length; j++) {
				if (!gapIndices.has(j)) continue;
				const xF = PAD_LEFT + ((j - viewStart) / vW) * PW;
				const xW = PW / vW;
				const xi = Math.floor(xF);
				const xw = Math.max(1, Math.round(xF + xW) - xi);
				const step = Math.max(4, xw * 0.6);
				ctx.beginPath();
				for (let d = -plotH; d < xw + plotH; d += step) {
					const x1 = xi + d, y1 = PAD_TOP;
					const x2 = xi + d + plotH, y2 = PAD_TOP + plotH;
					const cx1 = Math.max(xi, x1), cy1 = PAD_TOP + Math.max(0, xi - x1);
					const cx2 = Math.min(xi + xw - 1, x2), cy2 = PAD_TOP + plotH - Math.max(0, x2 - (xi + xw - 1));
					if (cx1 <= cx2) { ctx.moveTo(cx1, cy1); ctx.lineTo(cx2, cy2); }
				}
				ctx.stroke();
			}
			ctx.restore();
		}

		// Separator line between header and data sections
		if (headerRows.length > 0) {
			const sepY = Math.floor(PAD_TOP + headerRows.length * HEADER_H + SEP_GAP / 2) + 0.5;
			ctx.strokeStyle = sepClr;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(PAD_LEFT, sepY);
			ctx.lineTo(PAD_LEFT + PW, sepY);
			ctx.stroke();
		}

		// Y labels
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		for (const { def, y, h } of rows) {
			ctx.fillStyle = mutedColor;
			ctx.font = `${h >= 24 ? 11 : 10}px system-ui, sans-serif`;
			ctx.fillText(def.label, PAD_LEFT - 6, y + (h - 1) / 2);
		}

		// X axis ticks + labels
		const tickStep = (() => {
			if (cellW >= 60) return 1;
			if (cellW >= 28) return 5;
			if (cellW >= 14) return 10;
			if (cellW >= 7)  return 20;
			if (cellW >= 3.5) return 50;
			return 100;
		})();
		ctx.font = '10px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		for (let j = viewStart; j < viewEnd && j < positions.length; j++) {
			if ((j - viewStart) % tickStep !== 0 && j !== viewStart) continue;
			if (j === viewStart && (j % tickStep !== 0)) {
				// only show if it aligns to step
				const nextTick = viewStart + (tickStep - (viewStart % tickStep));
				if (j !== nextTick) continue;
			}
			const x = PAD_LEFT + ((j - viewStart + 0.5) / vW) * PW;
			ctx.strokeStyle = tickClr;
			ctx.lineWidth = 0.5;
			ctx.beginPath();
			ctx.moveTo(x, PAD_TOP + plotH);
			ctx.lineTo(x, PAD_TOP + plotH + 4);
			ctx.stroke();
			ctx.fillStyle = mutedColor;
			ctx.fillText(positions[j], x, PAD_TOP + plotH + 6);
		}

		// Plot border
		ctx.strokeStyle = borderClr;
		ctx.lineWidth = 1;
		ctx.strokeRect(PAD_LEFT + 0.5, PAD_TOP + 0.5, PW - 1, plotH - 1);

		// Colorbar
		if (colorbar) drawColorbar(ctx, W, plotH, dark, mutedColor);
	}

	function drawColorbar(ctx: CanvasRenderingContext2D, W: number, plotH: number, dark: boolean, mutedColor: string) {
		if (!colorbar) return;
		const PR = padRight;
		const cbX = W - PR + 16;
		const cbW = 14;
		const cbY = PAD_TOP;
		const cbH = plotH;
		const steps = 80;

		for (let i = 0; i < steps; i++) {
			const t = 1 - i / steps;
			const v = colorbar.vmin + t * (colorbar.vmax - colorbar.vmin);
			const [r, g, b] = colorbar.colorFn(v, colorbar.vmin, colorbar.vmax, dark);
			ctx.fillStyle = `rgb(${r},${g},${b})`;
			ctx.fillRect(cbX, cbY + (i / steps) * cbH, cbW, cbH / steps + 0.5);
		}

		ctx.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
		ctx.lineWidth = 0.5;
		ctx.strokeRect(cbX, cbY, cbW, cbH);

		const fmt = colorbar.fmt ?? ((v: number) => v.toFixed(1));
		const ticks = [0, 0.25, 0.5, 0.75, 1.0];
		ctx.fillStyle = mutedColor;
		ctx.font = '9px system-ui, sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		for (const t of ticks) {
			const tv = colorbar.vmin + t * (colorbar.vmax - colorbar.vmin);
			const yt = cbY + cbH - t * cbH;
			ctx.fillText(fmt(tv), cbX + cbW + 4, yt);
		}

		ctx.save();
		ctx.translate(W - 9, cbY + cbH / 2);
		ctx.rotate(Math.PI / 2);
		ctx.textAlign = 'center';
		ctx.font = '10px system-ui, sans-serif';
		ctx.fillStyle = mutedColor;
		ctx.fillText(colorbar.label, 0, 0);
		ctx.restore();
	}

	// ── Interactions ──────────────────────────────────────────────────────────

	function cssCoords(e: MouseEvent): [number, number] {
		if (!canvas) return [0, 0];
		const r = canvas.getBoundingClientRect();
		const scaleX = canvas.width / r.width;
		const scaleY = canvas.height / r.height;
		return [(e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY];
	}

	function posAtCssX(cssX: number): number {
		const PW = canvas!.width - PAD_LEFT - padRight;
		const vW = viewEnd - viewStart;
		const frac = (cssX - PAD_LEFT) / PW;
		return Math.max(0, Math.min(positions.length - 1, viewStart + Math.round(frac * vW)));
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		if (!positions.length) return;
		const [cssX] = cssCoords(e);
		const PW = canvas!.width - PAD_LEFT - padRight;
		const frac = Math.max(0, Math.min(1, (cssX - PAD_LEFT) / PW));
		const vW = viewEnd - viewStart;
		const factor = e.deltaY > 0 ? 1.3 : 0.77;
		const newW = Math.max(5, Math.min(positions.length, Math.round(vW * factor)));
		const anchor = viewStart + frac * vW;
		let newStart = Math.round(anchor - frac * newW);
		newStart = Math.max(0, Math.min(positions.length - newW, newStart));
		viewStart = newStart;
		viewEnd = newStart + newW;
		isZoomed = newW < positions.length;
		redraw();
	}

	function onMouseDown(e: MouseEvent) {
		isDragging = true;
		dragStartX = e.clientX;
		dragViewStart = viewStart;
		e.preventDefault();
	}

	function onMouseMove(e: MouseEvent) {
		const [cssX, cssY] = cssCoords(e);
		const PW = canvas!.width - PAD_LEFT - padRight;

		if (isDragging) {
			const rect = canvas!.getBoundingClientRect();
			const cssPerPos = (rect.width / canvas!.width) * PW / (viewEnd - viewStart);
			const delta = Math.round(-(e.clientX - dragStartX) / cssPerPos);
			const vW = viewEnd - viewStart;
			const newStart = Math.max(0, Math.min(positions.length - vW, dragViewStart + delta));
			if (newStart !== viewStart) {
				viewStart = newStart;
				viewEnd = newStart + vW;
				redraw();
			}
		}

		if (cssX < PAD_LEFT || cssX > PAD_LEFT + PW) { hover = null; return; }
		const posIdx = posAtCssX(cssX);
		const rows   = buildRows();
		const row    = rowAtCssY(cssY, rows);
		if (!row || posIdx < 0 || posIdx >= positions.length) { hover = null; return; }
		const isGap  = gapIndices?.has(posIdx) ?? false;
		const value  = (!isGap && posIdx < row.def.values.length) ? row.def.values[posIdx] : null;
		hover = { cssX, cssY, posLabel: positions[posIdx], rowLabel: row.def.label, value, isGap };
	}

	function onMouseUp()    { isDragging = false; }
	function onMouseLeave() { isDragging = false; hover = null; }

	function resetZoom() {
		viewStart = 0;
		viewEnd   = positions.length;
		isZoomed  = false;
		redraw();
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	$effect(() => {
		if (!container) return;
		const ro = new ResizeObserver((entries) => {
			const w = Math.floor(entries[0].contentRect.width);
			if (w === cw || w === 0) return;
			cw = w;
			if (canvas) { canvas.width = w; redraw(); }
		});
		ro.observe(container);
		return () => ro.disconnect();
	});

	$effect(() => {
		void positions, headerRows, dataRows, $theme, ch, cw;
		if (!canvas) return;
		canvas.width  = cw;
		canvas.height = ch;
		viewStart = 0;
		viewEnd   = positions.length;
		isZoomed  = false;
		redraw();
	});
</script>

<div class="hm-outer">
	<div class="hm-wrap" bind:this={container}>
		<canvas
			bind:this={canvas}
			class="hm-canvas"
			style:cursor={isDragging ? 'grabbing' : 'crosshair'}
			onwheel={onWheel}
			onmousedown={onMouseDown}
			onmousemove={onMouseMove}
			onmouseup={onMouseUp}
			onmouseleave={onMouseLeave}
		></canvas>

		{#if hover}
			{@const flip = hover.cssX > cw * 0.68}
			<div
				class="hm-tooltip"
				style:left={flip ? 'auto' : `${hover.cssX + 14}px`}
				style:right={flip ? `${cw - hover.cssX + 14}px` : 'auto'}
				style:top={`${Math.max(4, hover.cssY - 36)}px`}
			>
				<span class="tt-row"><span class="tt-lbl">Position</span><span class="tt-val">{hover.posLabel}</span></span>
				{#if hover.isGap}
					<span class="tt-row"><span class="tt-lbl tt-gap">No data (gap)</span></span>
				{:else}
					<span class="tt-row">
						<span class="tt-lbl">{hover.rowLabel}</span>
						<span class="tt-val">{hover.value === null ? 'WT' : hover.value.toFixed(2)}</span>
					</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if isZoomed}
		<div class="hm-footer">
			<span class="zoom-hint">Scroll to zoom · drag to pan</span>
			<button class="reset-btn" onclick={resetZoom} type="button">Reset zoom</button>
		</div>
	{:else if positions.length > 0}
		<div class="hm-footer">
			<span class="zoom-hint">Scroll to zoom · drag to pan</span>
		</div>
	{/if}
</div>

<style>
	.hm-outer {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.hm-wrap {
		position: relative;
		width: 100%;
	}

	.hm-canvas {
		display: block;
		width: 100%;
	}

	.hm-tooltip {
		position: absolute;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.3rem 0.6rem;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		z-index: 10;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
		min-width: 130px;
	}

	.tt-row {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.75rem;
	}

	.tt-lbl {
		color: var(--text-muted);
	}

	.tt-gap {
		font-style: italic;
	}

	.tt-val {
		color: var(--text);
		font-family: monospace;
		font-weight: 600;
	}

	.hm-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.zoom-hint {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.reset-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.18rem 0.55rem;
		font-size: 0.72rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.reset-btn:hover {
		border-color: var(--text-muted);
		color: var(--text);
	}
</style>
