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
		height = '400px'
	}: {
		pdbUrl: string;
		residues?: ResidueStyle[];
		height?: string;
	} = $props();

	let container: HTMLDivElement;
	let viewer = $state<any>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let spinning = $state(false);

	function applyStyles(res: ResidueStyle[]) {
		if (!viewer) return;
		// Base: full protein as light-grey cartoon
		viewer.setStyle({}, { cartoon: { color: '#cbd5e1', opacity: 0.9 } });

		// Per-residue color from supplied list
		for (const r of res) {
			viewer.addStyle(
				{ chain: r.chain, resi: r.resNum },
				{ cartoon: { color: r.color } }
			);
			if (r.selected) {
				viewer.addStyle(
					{ chain: r.chain, resi: r.resNum },
					{ sphere: { color: r.color, opacity: 0.88, radius: 1.05 } }
				);
			}
		}
		viewer.render();
	}

	// Re-apply styles reactively whenever residues prop changes
	$effect(() => {
		const r = residues; // create reactive dependency
		if (viewer) applyStyles(r);
	});

	onMount(async () => {
		try {
			const mol3d = await import('3dmol');
			const v = (mol3d as any).createViewer(container, {
				backgroundColor: '#f8fafc',
				antialias: true,
			});

			const res = await fetch(pdbUrl);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const pdbText = await res.text();

			v.addModel(pdbText, 'pdb');
			viewer = v;       // triggers the $effect above
			v.zoomTo();
			v.render();
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load structure';
		} finally {
			loading = false;
		}
	});

	onDestroy(() => viewer?.clear());

	function toggleSpin() {
		spinning = !spinning;
		viewer?.setSpin(spinning);
	}
	function resetView() {
		viewer?.zoomTo();
		viewer?.render();
	}
</script>

<div class="wrap" style:--h={height}>
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
		background: #f8fafc;
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
