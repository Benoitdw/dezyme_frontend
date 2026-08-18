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

	// `on` drives the blink: the highlight alternates between a wide halo and a tight one
	function applyStyles(res: ResidueStyle[], on = true) {
		if (!viewer) return;
		// Base: full protein as light-grey cartoon
		viewer.setStyle({}, { cartoon: { color: '#cbd5e1', opacity: 0.9 } });

		// Per-residue color from supplied list
		for (const r of res) {
			viewer.addStyle(
				{ chain: r.chain, resi: r.resNum },
				{ cartoon: { color: r.color } }
			);
		}

		// Selected residues are drawn last, so they always sit on top
		for (const sel of res.filter((r) => r.selected)) {
			const spec = { chain: sel.chain, resi: sel.resNum };
			viewer.addStyle(spec, { cartoon: { color: highlightColor } });
			viewer.addStyle(spec, { stick: { color: highlightColor, radius: 0.3 } });
			viewer.addStyle(spec, {
				sphere: { color: highlightColor, opacity: on ? 0.5 : 0.22, radius: on ? 2.6 : 1.5 }
			});
		}
		viewer.render();
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

	// A short blink on each new selection: a handful of restyles, not a render loop
	const BLINK_STEPS = 6;
	const BLINK_MS = 320;
	let blinkTimer: ReturnType<typeof setInterval> | null = null;

	function blinkSelection(res: ResidueStyle[]) {
		if (blinkTimer) clearInterval(blinkTimer);
		let step = 0;
		applyStyles(res, true);
		blinkTimer = setInterval(() => {
			step += 1;
			if (step >= BLINK_STEPS) {
				clearInterval(blinkTimer!);
				blinkTimer = null;
				applyStyles(res, true);   // settle on the visible state
				return;
			}
			applyStyles(res, step % 2 === 0);
		}, BLINK_MS);
	}

	// Re-apply styles reactively whenever residues prop changes
	let lastSelectedKey: string | null = null;
	$effect(() => {
		const r = residues; // create reactive dependency
		if (!viewer) return;
		const key = r.filter((x) => x.selected).map((x) => `${x.chain}${x.resNum}`).join(',') || null;
		if (key && key !== lastSelectedKey) {
			lastSelectedKey = key;
			blinkSelection(r);
		} else {
			lastSelectedKey = key;
			applyStyles(r, true);
		}
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
		if (blinkTimer) clearInterval(blinkTimer);
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
