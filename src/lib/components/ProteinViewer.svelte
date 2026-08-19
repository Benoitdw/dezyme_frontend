<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	export interface ResidueStyle {
		chain: string;
		resNum: number;
		color: string;    // hex color for cartoon
		selected?: boolean; // show sphere on top
	}

	let {
		pdbUrl,
		residues = [] as ResidueStyle[],
		height = '400px',
		background = '#f8fafc',
		highlightColor = '#ff00d4',  // deliberately outside the blue↔red ΔΔG scale
		labelled = null,
		onresiduehover
	}: {
		pdbUrl: string;
		residues?: ResidueStyle[];
		height?: string;
		background?: string;
		highlightColor?: string;
		labelled?: { chain: string; resNum: number } | null;
		onresiduehover?: (r: { chain: string; resNum: number } | null) => void;
	} = $props();

	let container: HTMLDivElement;
	let viewer = $state<any>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let spinning = $state(false);

	// Repainting the whole protein costs one 3Dmol atom scan per call, which is slow
	// on large structures. The base coloring is therefore rebuilt only when the colors
	// change; selecting or clearing only restyles the residues that moved.
	const BASE_COLOR = '#cbd5e1';
	const specOf = (r: ResidueStyle) => ({ chain: r.chain, resi: r.resNum });
	const keyOf  = (r: ResidueStyle) => `${r.chain}:${r.resNum}`;

	let baseSignature: string | null = null;
	let shownSelection: ResidueStyle[] = [];

	function applyBase(res: ResidueStyle[]) {
		if (!viewer) return;
		// Base: full protein as light-grey cartoon
		viewer.setStyle({}, { cartoon: { color: BASE_COLOR, opacity: 0.9 } });

		// One pass per (chain, color) rather than one per residue
		const groups = new Map<string, { chain: string; color: string; resi: number[] }>();
		for (const r of res) {
			const g = groups.get(`${r.chain}|${r.color}`);
			if (g) g.resi.push(r.resNum);
			else groups.set(`${r.chain}|${r.color}`, { chain: r.chain, color: r.color, resi: [r.resNum] });
		}
		for (const g of groups.values()) {
			viewer.addStyle({ chain: g.chain, resi: g.resi }, { cartoon: { color: g.color } });
		}
		shownSelection = [];
	}

	function drawSelection(res: ResidueStyle[]) {
		if (!viewer) return;
		const selected = res.filter((r) => r.selected);
		const stillSelected = new Set(selected.map(keyOf));

		// Residues that left the selection go back to their own color. setStyle replaces,
		// so the stick and the halo of the highlight go away with it.
		for (const prev of shownSelection) {
			if (stillSelected.has(keyOf(prev))) continue;
			viewer.setStyle(specOf(prev), { cartoon: { color: prev.color } });
		}

		for (const sel of selected) {
			const spec = specOf(sel);
			viewer.setStyle(spec, { cartoon: { color: highlightColor } });
			viewer.addStyle(spec, { stick: { color: highlightColor, radius: 0.3 } });
			viewer.addStyle(spec, { sphere: { color: highlightColor, opacity: 0.5, radius: 2.6 } });
		}
		shownSelection = selected;
	}

	// The label follows the hover, wherever it comes from: table, heatmap or the
	// structure itself. Labels are handled apart from the styles so that moving the
	// mouse only costs a re-render, not a full restyle of every residue.
	$effect(() => {
		const target = labelled;
		if (!viewer) return;
		viewer.removeAllLabels?.();
		if (target) {
			viewer.addResLabels?.({ chain: target.chain, resi: target.resNum }, {
				font: 'sans-serif', fontSize: 11, fontColor: 'white',
				backgroundColor: highlightColor, backgroundOpacity: 0.9, showBackground: true
			});
		}
		viewer.render();
	});

	// Re-apply styles reactively whenever residues prop changes
	$effect(() => {
		const r = residues; // create reactive dependency
		if (!viewer) return;

		const signature = r.map((x) => `${x.chain}${x.resNum}${x.color}`).join('|');
		if (signature !== baseSignature) {
			baseSignature = signature;
			applyBase(r);
		}
		drawSelection(r);
		viewer.render();
	});

	onMount(async () => {
		try {
			const mol3d = await import('3dmol');
			const v = (mol3d as any).createViewer(container, {
				backgroundColor: background,
				antialias: true,
			});

			const res = await fetch(pdbUrl);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const pdbText = await res.text();

			v.addModel(pdbText, 'pdb');
			v.setHoverable(
				{}, true,
				(atom: any) => {
					if (atom) onresiduehover?.({ chain: atom.chain, resNum: atom.resi });
				},
				() => onresiduehover?.(null)
			);
			viewer = v;       // triggers the $effect above
			v.zoomTo();
			v.render();
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load structure';
		} finally {
			loading = false;
		}
	});

	// The panel is resizable: keep the WebGL canvas in step with its container
	let resizeObserver: ResizeObserver | null = null;
	$effect(() => {
		if (!viewer || !container) return;
		resizeObserver = new ResizeObserver(([entry]) => {
			// The panel is hidden with display:none, which reports a 0×0 box
			const box = entry.contentRect;
			if (box.width < 1 || box.height < 1) return;
			viewer.resize();
			viewer.render();
		});
		resizeObserver.observe(container);
		return () => resizeObserver?.disconnect();
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		viewer?.clear();
	});

	function toggleSpin() {
		spinning = !spinning;
		viewer?.spin(spinning);
	}
	function resetView() {
		viewer?.zoomTo();
		viewer?.render();
	}

	/** Fly to the selected residues, exposed so the parent can offer a "focus" action */
	export function focusSelected() {
		const sel = residues.filter((r) => r.selected);
		if (!viewer || sel.length === 0) return;
		viewer.zoomTo({ chain: sel[0].chain, resi: sel.map((r) => r.resNum) });
		viewer.render();
	}
</script>

<div class="wrap" style:--h={height} style:--viewer-bg={background}>
	{#if loading}
		<div class="overlay">
			<span class="spinner"></span>
			Loading structure…
		</div>
	{:else if loadError}
		<div class="overlay err">{loadError}</div>
	{/if}

	<div bind:this={container} class="canvas"></div>

	{#if !loading && !loadError}
		<div class="controls">
			<button class="ctrl" onclick={toggleSpin} title={spinning ? 'Stop rotation' : 'Rotate'}>
				{spinning ? '⏸' : '↻'}
			</button>
			<button class="ctrl" onclick={resetView} title="Reset view">⊙</button>
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		height: var(--h);
		border-radius: 0.875rem;
		overflow: hidden;
		border: 1px solid var(--border);
		background: var(--viewer-bg);
	}

	:root[data-theme='dark'] .wrap {
		background: #0f172a;
	}

	.canvas {
		width: 100%;
		height: 100%;
	}

	.overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-muted);
		background: inherit;
	}

	.overlay.err { color: #ef4444; }

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid var(--border);
		border-top-color: var(--text-muted);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.controls {
		position: absolute;
		bottom: 0.75rem;
		right: 0.75rem;
		display: flex;
		gap: 0.3rem;
		z-index: 10;
	}

	.ctrl {
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid #e2e8f0;
		border-radius: 0.35rem;
		width: 28px;
		height: 28px;
		font-size: 0.85rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(4px);
		transition: background 0.1s;
		padding: 0;
	}

	.ctrl:hover { background: #fff; }
</style>
