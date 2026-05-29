<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme';
	import ProteinViewer from '$lib/components/ProteinViewer.svelte';
	import MsaViewer from '$lib/components/MsaViewer.svelte';
	import MutationHeatmap, { ddgColor as hmDdgColor, rsaColor as hmRsaColor } from '$lib/components/MutationHeatmap.svelte';
	import type { HeatmapRowDef, ColorbarDef } from '$lib/components/MutationHeatmap.svelte';
	import { groupByPosition, type EvolMutationRow, type PositionInfo } from '$lib/utils/popmusic';
	import type { Chart as ChartType } from 'chart.js';
	import JobLogs from '$lib/components/JobLogs.svelte';

	let Chart = $state<typeof ChartType | null>(null);

	interface Props {
		mutations: EvolMutationRow[];
		pdbUrl: string;
		fastaContent: string | null;
		zipUrl: string | null;
		lambda: number;
		logContent?: string | null;
		title?: string;
		subtitle?: string;
		backUrl?: string;
	}

	let { mutations, pdbUrl, fastaContent, zipUrl, lambda, logContent, title, subtitle, backUrl }: Props = $props();

	const ACCENT = '#6366f1';

	type Tab = 'mutations' | 'summary' | 'parameters' | 'log';
	type ScoreKey = 'DV' | 'StructureDCA';

	const SCORE_LABELS: Record<ScoreKey, string> = {
		DV: 'ΔΔG',
		StructureDCA: 'StructureDCA'
	};

	const SS_LABELS: Record<string, string> = {
		H: 'Helix', G: '310-Helix', I: 'π-Helix',
		E: 'Sheet', B: 'Bridge', T: 'Turn', S: 'Bend', C: 'Coil'
	};

	let tab = $state<Tab>('mutations');
	let scoreKey = $state<ScoreKey>('DV');
	let selectedPosIdx = $state<number | null>(null);
	let showViewer = $state(false);
	let everOpened = $state(false);
	$effect(() => { if (showViewer) everOpened = true; });

	// ── Floating viewer drag ─────────────────────────────────────────────────
	let floatX = $state(0);
	let floatY = $state(0);
	let dragOffX = 0, dragOffY = 0;
	function startDrag(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		dragOffX = e.clientX - floatX;
		dragOffY = e.clientY - floatY;
		window.addEventListener('pointermove', onDrag);
		window.addEventListener('pointerup', stopDrag, { once: true });
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function onDrag(e: PointerEvent) {
		floatX = Math.max(0, Math.min(window.innerWidth - 420, e.clientX - dragOffX));
		floatY = Math.max(0, Math.min(window.innerHeight - 380, e.clientY - dragOffY));
	}
	function stopDrag() { window.removeEventListener('pointermove', onDrag); }

	// ── Grouped positions ────────────────────────────────────────────────────
	const positions = $derived(groupByPosition(mutations));
	const selectedPos = $derived(selectedPosIdx !== null ? positions[selectedPosIdx] : null);

	// ── Heatmap ──────────────────────────────────────────────────────────────
	const AA_ORDER = ['A','C','D','E','F','G','H','I','K','L','M','N','P','Q','R','S','T','V','W','Y'];

	function lerp(a: number, b: number, t: number): number {
		return Math.round(a + (b - a) * t);
	}

	function pldtColor(v: number, _vmin: number, _vmax: number, _dark: boolean): [number, number, number] {
		const t = Math.max(0, Math.min(1, v / 100));
		if (t < 0.5) {
			const s = t * 2;
			return [lerp(220, 253, s), lerp(50, 190, s), lerp(50, 0, s)];
		} else if (t < 0.7) {
			const s = (t - 0.5) / 0.2;
			return [lerp(253, 100, s), lerp(190, 170, s), lerp(0, 220, s)];
		} else {
			const s = (t - 0.7) / 0.3;
			return [lerp(100, 30, s), lerp(170, 100, s), lerp(220, 200, s)];
		}
	}

	function scoreColorFn(_key: ScoreKey): (v: number, vmin: number, vmax: number, dark: boolean) => [number, number, number] {
		return hmDdgColor;
	}

	function getMutScore(pos: PositionInfo, aa: string): number | null {
		if (aa === pos.wtAa) return null;
		const row = pos.mutations.get(aa);
		if (!row) return null;
		return scoreKey === 'DV' ? row.DV : row.StructureDCA;
	}

	const hmPositionLabels = $derived(positions.map(p => `${p.chain}${p.resNumPdb}`));

	const hmHeaderRows = $derived<HeatmapRowDef[]>([
		{
			label: 'RSA',
			values: positions.map(p => p.RSA),
			colorFn: hmRsaColor,
			vmin: 0, vmax: 100,
			fmt: v => v.toFixed(0)
		},
		{
			label: 'pLDDT',
			values: positions.map(p => p.pLDDT),
			colorFn: pldtColor,
			vmin: 0, vmax: 100,
			fmt: v => v.toFixed(0)
		},
		{
			label: 'Mean',
			values: positions.map(p =>
				scoreKey === 'DV' ? p.meanDV : p.meanStructureDCA
			),
			colorFn: scoreColorFn(scoreKey),
			fmt: v => v.toFixed(2)
		}
	]);

	const hmDataRows = $derived<HeatmapRowDef[]>(
		AA_ORDER.map(aa => ({
			label: aa,
			values: positions.map(p => getMutScore(p, aa)),
			colorFn: scoreColorFn(scoreKey),
			fmt: (v: number) => v.toFixed(2)
		}))
	);

	const hmColorbar = $derived.by<ColorbarDef>(() => {
		const allVals = scoreKey === 'DV'
			? mutations.map(m => m.DV)
			: mutations.map(m => m.StructureDCA);
		if (!allVals.length) return { label: scoreKey === 'DV' ? 'ΔΔG (kcal/mol)' : 'StructureDCA', vmin: -2, vmax: 2, colorFn: hmDdgColor };
		const mn = Math.max(-5, Math.floor(Math.min(...allVals) * 10) / 10);
		const mx = Math.min(5, Math.ceil(Math.max(...allVals) * 10) / 10);
		return {
			label: scoreKey === 'DV' ? 'ΔΔG (kcal/mol)' : 'StructureDCA',
			vmin: mn, vmax: mx,
			colorFn: hmDdgColor,
			fmt: v => (v > 0 ? '+' : '') + v.toFixed(1)
		};
	});

	// ── 3D viewer ────────────────────────────────────────────────────────────
	function ddgHex(v: number): string {
		if (v < -0.5) return '#22c55e';
		if (v < 0)    return '#86efac';
		if (v < 0.5)  return '#fb923c';
		return '#ef4444';
	}

	const viewerResidues = $derived(
		positions.map((p, i) => ({
			chain: p.chain,
			resNum: p.resNumPdb,
			color: ddgHex(p.meanDV),
			selected: i === selectedPosIdx
		}))
	);

	// ── Table sorting ─────────────────────────────────────────────────────────
	type TableCol = 'pos' | 'RSA' | 'meanDV' | 'secStruct' | 'pLDDT' | 'gap_ratio';
	let tableSort = $state<{ col: TableCol; dir: 1 | -1 }>({ col: 'pos', dir: 1 });

	function toggleSort(col: TableCol) {
		tableSort = tableSort.col === col
			? { col, dir: (tableSort.dir * -1) as 1 | -1 }
			: { col, dir: 1 };
	}

	const sortedPositions = $derived.by(() => {
		const dir = tableSort.dir;
		return [...positions].sort((a, b) => {
			switch (tableSort.col) {
				case 'pos':       return (a.msaPos - b.msaPos) * dir;
				case 'RSA':       return (a.RSA - b.RSA) * dir;
				case 'meanDV':    return (a.meanDV - b.meanDV) * dir;
				case 'pLDDT':     return (a.pLDDT - b.pLDDT) * dir;
				case 'gap_ratio': return (a.gap_ratio - b.gap_ratio) * dir;
				case 'secStruct': return a.secondary_structure.localeCompare(b.secondary_structure) * dir;
				default: return 0;
			}
		});
	});

	function selectPositionFromTable(pos: PositionInfo) {
		const idx = positions.findIndex(p => p.msaPos === pos.msaPos);
		selectedPosIdx = selectedPosIdx === idx ? null : idx;
	}

	function ddgClass(v: number): string {
		if (v < -0.5) return 'ddg-ss';
		if (v < 0)    return 'ddg-sl';
		if (v < 0.5)  return 'ddg-dl';
		return 'ddg-ds';
	}

	// ── Chart ─────────────────────────────────────────────────────────────────
	let canvasDist = $state<HTMLCanvasElement | undefined>();

	function chartColors() {
		const isDark = $theme === 'dark';
		return {
			text: isDark ? '#94a3b8' : '#64748b',
			grid: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'
		};
	}

	function makeDistChart(canvas: HTMLCanvasElement, muts: EvolMutationRow[], C = Chart!) {
		const c = chartColors();
		const BIN = 0.2, LO = -3, HI = 3;
		const bins: number[] = Array(Math.round((HI - LO) / BIN)).fill(0);
		for (const m of muts) {
			const i = Math.floor((Math.min(Math.max(m.DV, LO), HI - 0.001) - LO) / BIN);
			bins[i]++;
		}
		const labels = bins.map((_, i) => (LO + i * BIN).toFixed(1));
		return new C(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [{
					data: bins,
					backgroundColor: labels.map(l => parseFloat(l) < 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'),
					borderWidth: 0, barPercentage: 1.0, categoryPercentage: 1.0
				}]
			},
			options: {
				responsive: true, maintainAspectRatio: false, animation: false,
				plugins: {
					legend: { display: false },
					tooltip: { callbacks: {
						title: ctx => `ΔΔG ≈ ${ctx[0].label} kcal/mol`,
						label: ctx => ` ${ctx.raw} mutations`
					}}
				},
				scales: {
					x: { ticks: { color: c.text, maxTicksLimit: 12, font: { size: 11 } }, grid: { display: false }, title: { display: true, text: 'ΔΔG (kcal/mol)', color: c.text, font: { size: 11 } } },
					y: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid }, title: { display: true, text: 'Mutations', color: c.text, font: { size: 11 } } }
				}
			}
		});
	}

	$effect(() => {
		if (!Chart || !canvasDist) return;
		void $theme;
		const chart = makeDistChart(canvasDist, mutations);
		return () => chart.destroy();
	});

	const clampedLambda = $derived(Math.min(1, Math.max(0, lambda)));
	const beamAngle = $derived((clampedLambda - 0.5) * 40);

	onMount(() => {
		floatX = Math.max(16, window.innerWidth - 452);
		floatY = Math.max(16, window.innerHeight - 420);
		import('chart.js').then(({ Chart: C, registerables }) => {
			C.register(...registerables);
			Chart = C as unknown as typeof ChartType;
		});
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') showViewer = false; };
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<div class="page" style="--accent: {ACCENT}">
	<!-- Header -->
	<div class="header">
		<div class="header-left">
			<span class="tool-badge">PopMuSiC</span>
			<div>
				<h1 class="page-title">{title ?? 'Results'}</h1>
				{#if subtitle}<span class="page-sub">{subtitle}</span>{/if}
			</div>
		</div>
		<div class="header-actions">
			{#if zipUrl}<a href={zipUrl} download class="action-btn dl-btn">↓ Download ZIP</a>{/if}
			{#if backUrl}
				<a href={backUrl} class="action-btn">New analysis</a>
			{/if}
		</div>
	</div>

	<!-- Tabs -->
	<div class="tabs">
		<button class="tab" class:active={tab === 'mutations'} onclick={() => (tab = 'mutations')}>
			All mutations <span class="tab-count">{mutations.length}</span>
		</button>
		<button class="tab" class:active={tab === 'summary'} onclick={() => (tab = 'summary')}>
			Summary
		</button>
		<button class="tab" class:active={tab === 'parameters'} onclick={() => (tab = 'parameters')}>
			Parameters
		</button>
		{#if logContent}
			<button class="tab" class:active={tab === 'log'} onclick={() => (tab = 'log')}>
				Log
			</button>
		{/if}
		<div class="tabs-spacer"></div>
		<button class="tab-3d" class:tab-3d-active={showViewer} onclick={() => (showViewer = !showViewer)}>
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
				<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
			</svg>
			3D
			{#if selectedPosIdx !== null}<span class="tab-3d-badge">1</span>{/if}
		</button>
	</div>

	<!-- Tab 1: All mutations -->
	{#if tab === 'mutations'}
		<!-- Heatmap -->
		<div class="heatmap-card">
			<div class="heatmap-card-header">
				<div class="heatmap-header-top">
					<div>
						<span class="heatmap-title">Mutation effect map</span>
						<span class="heatmap-sub">
							{SCORE_LABELS[scoreKey]} per position and amino acid substitution
							{#if scoreKey === 'DV'} — red = destabilizing, blue = stabilizing{/if}
						</span>
					</div>
					<!-- Score selector -->
					<div class="score-selector">
						{#each (['DV', 'StructureDCA'] as ScoreKey[]) as key}
							<button
								class="score-btn"
								class:active={scoreKey === key}
								onclick={() => (scoreKey = key)}
							>{SCORE_LABELS[key]}</button>
						{/each}
					</div>
				</div>
			</div>
			<MutationHeatmap
				positions={hmPositionLabels}
				headerRows={hmHeaderRows}
				dataRows={hmDataRows}
				colorbar={hmColorbar}
				selectedCol={selectedPosIdx}
				oncolumnclick={(colIdx) => {
					selectedPosIdx = selectedPosIdx === colIdx ? null : colIdx;
				}}
			/>
		</div>

		<!-- Position table -->
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th class="sortable" class:sort-active={tableSort.col === 'pos'} onclick={() => toggleSort('pos')}>
							Position <span class="sort-arrow">{tableSort.col === 'pos' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th>WT</th>
						<th class="sortable" class:sort-active={tableSort.col === 'secStruct'} onclick={() => toggleSort('secStruct')}>
							Sec. Struct. <span class="sort-arrow">{tableSort.col === 'secStruct' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th class="num sortable" class:sort-active={tableSort.col === 'RSA'} onclick={() => toggleSort('RSA')}>
							RSA <span class="sort-arrow">{tableSort.col === 'RSA' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th class="num sortable" class:sort-active={tableSort.col === 'meanDV'} onclick={() => toggleSort('meanDV')}>
							Mean ΔΔG <span class="sort-arrow">{tableSort.col === 'meanDV' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th class="num">Mean StructureDCA</th>
						<th class="num sortable" class:sort-active={tableSort.col === 'pLDDT'} onclick={() => toggleSort('pLDDT')}>
							pLDDT <span class="sort-arrow">{tableSort.col === 'pLDDT' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th class="num sortable" class:sort-active={tableSort.col === 'gap_ratio'} onclick={() => toggleSort('gap_ratio')}>
							Gap Ratio <span class="sort-arrow">{tableSort.col === 'gap_ratio' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedPositions as pos}
						{@const posIdx = positions.findIndex(p => p.msaPos === pos.msaPos)}
						{@const isSelected = posIdx === selectedPosIdx}
						<tr
							class="pos-row"
							class:is-sel={isSelected}
							onclick={() => selectPositionFromTable(pos)}
						>
							<td class="pos-cell">{pos.chain}{pos.resNumPdb}</td>
							<td class="aa-cell">{pos.wtAa}</td>
							<td><span class="ss-badge ss-{pos.secondary_structure}">{SS_LABELS[pos.secondary_structure] ?? pos.secondary_structure}</span></td>
							<td class="num">{pos.RSA.toFixed(1)}%</td>
							<td class="num"><span class="ddg-pill {ddgClass(pos.meanDV)}">{pos.meanDV > 0 ? '+' : ''}{pos.meanDV.toFixed(2)}</span></td>
							<td class="num mono">{pos.meanStructureDCA.toFixed(3)}</td>
							<td class="num">{pos.pLDDT.toFixed(1)}</td>
							<td class="num">{(pos.gap_ratio * 100).toFixed(1)}%</td>
						</tr>
					{/each}
					{#if sortedPositions.length === 0}
						<tr><td colspan="8" class="empty-cell">No data available</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Tab 2: Summary -->
	{#if tab === 'summary'}
		<div class="chart-card">
			<div class="chart-title">ΔΔG distribution</div>
			<div class="chart-sub">Distribution of all individual mutation effects — green = stabilizing, red = destabilizing</div>
			<div class="chart-wrap">
				<canvas bind:this={canvasDist}></canvas>
			</div>
		</div>
	{/if}

	<!-- Tab 3: Parameters -->
	{#if tab === 'parameters'}
		<div class="params-section">
			<div class="param-card">
				<div class="param-card-title">Model formula</div>
				<div class="formula-box">
					<div class="formula-text">
						ΔΔG = (1 &minus; &lambda;) &middot; ΔΔG<sub>stv</sub> + &lambda; &middot; ΔΔG<sub>eval</sub>
					</div>
					<div class="balance-container">
						<div class="balance-side left">
							<div class="balance-name">ΔΔG<sub>stv</sub></div>
							<div class="balance-coef">{(1 - clampedLambda).toFixed(3)}</div>
						</div>
						<svg class="balance-svg" viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
							<!-- fulcrum -->
							<line x1="100" y1="78" x2="100" y2="62" stroke="var(--text-muted)" stroke-width="2"/>
							<polygon points="100,62 93,78 107,78" fill="var(--text-muted)" opacity="0.5"/>
							<!-- beam + pans, rotating around pivot -->
							<g transform="rotate({beamAngle}, 100, 50)">
								<line x1="18" y1="50" x2="182" y2="50" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
								<circle cx="100" cy="50" r="3.5" fill="var(--text-muted)"/>
								<!-- left strings + pan -->
								<line x1="18" y1="50" x2="18" y2="64" stroke="var(--text-muted)" stroke-width="1.5"/>
								<line x1="10" y1="50" x2="26" y2="50" stroke="var(--accent)" stroke-width="2" opacity="0.3"/>
								<ellipse cx="18" cy="68" rx="10" ry="5" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
								<!-- right strings + pan -->
								<line x1="182" y1="50" x2="182" y2="64" stroke="var(--text-muted)" stroke-width="1.5"/>
								<line x1="174" y1="50" x2="190" y2="50" stroke="var(--accent)" stroke-width="2" opacity="0.3"/>
								<ellipse cx="182" cy="68" rx="10" ry="5" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
							</g>
						</svg>
						<div class="balance-side right">
							<div class="balance-name">ΔΔG<sub>eval</sub></div>
							<div class="balance-coef">{clampedLambda.toFixed(3)}</div>
						</div>
					</div>
				</div>
			</div>

			{#if fastaContent}
				<div class="param-card">
					<div class="param-card-title">Multiple sequence alignment</div>
					<MsaViewer msaContent={fastaContent} />
				</div>
			{/if}
		</div>
	{/if}

	<!-- Tab 4: Log -->
	{#if tab === 'log' && logContent}
		<JobLogs content={logContent} />
	{/if}
</div>

<!-- Floating 3D viewer -->
{#if everOpened}
	<div
		class="float-panel"
		class:float-hidden={!showViewer}
		style="left: {floatX}px; top: {floatY}px"
		role="dialog"
		aria-label="3D Structure viewer"
	>
		<div class="float-header" onpointerdown={startDrag} role="toolbar" aria-label="Drag to move" tabindex="0">
			<span class="float-title">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
				</svg>
				Structure
			</span>
			{#if selectedPos !== null}
				<span class="float-sel">{selectedPos.chain}{selectedPos.resNumPdb} ({selectedPos.wtAa})</span>
				<button class="float-clear" onclick={() => (selectedPosIdx = null)}>Clear</button>
			{/if}
			<button class="float-close" onclick={() => (showViewer = false)} aria-label="Close">✕</button>
		</div>
		<div class="float-body">
			<ProteinViewer {pdbUrl} residues={viewerResidues} height="340px" />
		</div>
	</div>
{/if}

<style>
	.page { max-width: 1100px; margin: 0 auto; padding: 2.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; }

	/* Header */
	.header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
	.header-left { display: flex; align-items: center; gap: 0.875rem; }
	.tool-badge { font-size: 0.8rem; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 0.375rem; padding: 0.25rem 0.6rem; white-space: nowrap; }
	.page-title { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0; line-height: 1.3; }
	.page-sub { font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 0.15rem; font-family: monospace; }
	.header-actions { display: flex; align-items: center; gap: 0.5rem; }
	.action-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.45rem 0.875rem; font-size: 0.85rem; color: var(--text); cursor: pointer; text-decoration: none; transition: border-color 0.15s; white-space: nowrap; align-self: center; }
	.action-btn:hover { border-color: var(--text-muted); }
	.dl-btn { display: flex; align-items: center; gap: 0.3rem; }

	/* Tabs */
	.tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0; }
	.tabs-spacer { flex: 1; }
	.tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; gap: 0.5rem; margin-bottom: -1px; }
	.tab:hover { color: var(--text); }
	.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
	.tab-count { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); background: var(--border); border-radius: 999px; padding: 0.1rem 0.45rem; }
	.tab.active .tab-count { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
	.tab-3d { display: flex; align-items: center; gap: 0.35rem; background: none; border: 1px solid var(--border); border-radius: 0.45rem; padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.15s; margin: auto 0; }
	.tab-3d:hover { border-color: var(--accent); color: var(--accent); }
	.tab-3d-active { background: color-mix(in srgb, var(--accent) 10%, transparent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent); }
	.tab-3d-badge { background: var(--accent); color: #fff; font-size: 0.68rem; font-weight: 700; border-radius: 999px; padding: 0.05rem 0.4rem; min-width: 18px; text-align: center; }

	/* Heatmap */
	.heatmap-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.heatmap-card-header { display: flex; flex-direction: column; gap: 0.5rem; }
	.heatmap-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
	.heatmap-title { font-size: 0.82rem; font-weight: 600; color: var(--text); display: block; }
	.heatmap-sub { font-size: 0.72rem; color: var(--text-muted); display: block; margin-top: 0.15rem; }
	.score-selector { display: flex; gap: 0.25rem; flex-shrink: 0; }
	.score-btn { background: var(--bg); border: 1px solid var(--border); border-radius: 0.4rem; padding: 0.3rem 0.75rem; font-size: 0.82rem; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
	.score-btn:hover { border-color: var(--text-muted); color: var(--text); }
	.score-btn.active { background: color-mix(in srgb, var(--accent) 10%, transparent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent); font-weight: 600; }

	/* Table */
	.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 0.875rem; background: var(--surface); }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
	.data-table th { text-align: left; padding: 0.65rem 0.875rem; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; background: var(--surface); }
	.data-table td { padding: 0.5rem 0.875rem; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
	.data-table tbody tr:last-child td { border-bottom: none; }
	.data-table th.num, .data-table td.num { text-align: right; }
	.sortable { cursor: pointer; user-select: none; }
	.sortable:hover { color: var(--text); }
	.sort-active { color: var(--accent) !important; }
	.sort-arrow { opacity: 0.35; font-size: 0.7rem; }
	.sort-active .sort-arrow { opacity: 1; color: var(--accent); }
	.pos-row { cursor: pointer; transition: background 0.1s; }
	.pos-row:hover { background: color-mix(in srgb, var(--accent) 4%, transparent); }
	.pos-row.is-sel { background: color-mix(in srgb, var(--accent) 8%, transparent); }
	.pos-cell { font-family: monospace; font-size: 0.875rem; white-space: nowrap; }
	.aa-cell { font-family: monospace; font-weight: 700; font-size: 1rem; }
	.mono { font-family: monospace; }
	.empty-cell { text-align: center; color: var(--text-muted); font-size: 0.875rem; padding: 2.5rem !important; }

	/* SS badges */
	.ss-badge { display: inline-block; font-size: 0.72rem; font-weight: 600; border-radius: 0.25rem; padding: 0.1rem 0.4rem; white-space: nowrap; }
	.ss-H { background: #ede9fe; color: #6d28d9; } .ss-G { background: #ddd6fe; color: #7c3aed; } .ss-I { background: #e0e7ff; color: #4338ca; }
	.ss-E { background: #fef3c7; color: #92400e; } .ss-B { background: #fde68a; color: #78350f; }
	.ss-T { background: #ccfbf1; color: #0f766e; } .ss-S { background: #cffafe; color: #0e7490; }
	.ss-C { background: color-mix(in srgb, var(--border) 80%, transparent); color: var(--text-muted); }
	:root[data-theme='dark'] .ss-H { background: #2e1065; color: #c4b5fd; } :root[data-theme='dark'] .ss-G { background: #3b0764; color: #d8b4fe; }
	:root[data-theme='dark'] .ss-I { background: #1e1b4b; color: #a5b4fc; } :root[data-theme='dark'] .ss-E { background: #451a03; color: #fcd34d; }
	:root[data-theme='dark'] .ss-B { background: #422006; color: #fbbf24; } :root[data-theme='dark'] .ss-T { background: #042f2e; color: #5eead4; }
	:root[data-theme='dark'] .ss-S { background: #083344; color: #67e8f9; }

	/* DDG pills */
	.ddg-pill { display: inline-block; font-family: monospace; font-size: 0.82rem; font-weight: 600; border-radius: 0.25rem; padding: 0.1rem 0.4rem; white-space: nowrap; }
	.ddg-ss { background: #bbf7d0; color: #14532d; } .ddg-sl { background: #dcfce7; color: #166534; }
	.ddg-dl { background: #ffedd5; color: #9a3412; } .ddg-ds { background: #fecaca; color: #7f1d1d; }
	:root[data-theme='dark'] .ddg-ss { background: #14532d; color: #86efac; } :root[data-theme='dark'] .ddg-sl { background: #166534; color: #bbf7d0; }
	:root[data-theme='dark'] .ddg-dl { background: #7c2d12; color: #fed7aa; } :root[data-theme='dark'] .ddg-ds { background: #7f1d1d; color: #fca5a5; }

	/* Summary tab */
	.chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
	.chart-title { font-size: 0.82rem; font-weight: 600; color: var(--text); }
	.chart-sub { font-size: 0.72rem; color: var(--text-muted); }
	.chart-wrap { position: relative; height: 300px; margin-top: 0.75rem; }
	.chart-wrap canvas { width: 100% !important; height: 100% !important; }

	/* Parameters tab */
	.params-section { display: flex; flex-direction: column; gap: 1.5rem; }
	.param-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
	.param-card-title { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
	.formula-box { display: flex; flex-direction: column; gap: 1.25rem; }
	.formula-text { font-size: 1.05rem; font-family: 'Georgia', serif; color: var(--text); padding: 0.75rem 1.25rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.5rem; display: inline-block; align-self: flex-start; }
	.formula-text sub { font-size: 0.65em; }
	.balance-container { display: flex; align-items: center; gap: 0.5rem; align-self: flex-start; }
	.balance-svg { width: 160px; height: 65px; flex-shrink: 0; }
	.balance-side { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; min-width: 64px; }
	.balance-side.left { align-items: flex-end; }
	.balance-side.right { align-items: flex-start; }
	.balance-name { font-size: 0.85rem; font-family: 'Georgia', serif; color: var(--text); }
	.balance-name sub { font-size: 0.65em; }
	.balance-coef { font-size: 1rem; font-weight: 700; font-family: monospace; color: var(--accent); }

	/* Floating 3D viewer */
	.float-panel { position: fixed; z-index: 150; width: 420px; background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; box-shadow: 0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08); display: flex; flex-direction: column; overflow: hidden; }
	.float-hidden { display: none; }
	.float-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem 0.6rem 1rem; border-bottom: 1px solid var(--border); cursor: grab; user-select: none; background: var(--surface); }
	.float-header:active { cursor: grabbing; }
	.float-title { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 700; color: var(--text); }
	.float-sel { font-size: 0.72rem; font-weight: 600; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); border-radius: 999px; padding: 0.1rem 0.45rem; white-space: nowrap; font-family: monospace; }
	.float-clear { background: none; border: 1px solid var(--border); border-radius: 0.3rem; padding: 0.1rem 0.4rem; font-size: 0.7rem; color: var(--text-muted); cursor: pointer; white-space: nowrap; }
	.float-clear:hover { border-color: var(--text-muted); color: var(--text); }
	.float-close { margin-left: auto; background: none; border: none; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 0.3rem; line-height: 1; }
	.float-close:hover { background: var(--border); color: var(--text); }
	.float-body { flex: 1; }

	/* Log tab */

	@media (max-width: 768px) { .page { padding: 1.5rem 1rem; } }
	@media (max-width: 480px) { .header { flex-direction: column; } .tabs { overflow-x: auto; } .score-selector { flex-wrap: wrap; } }
</style>
