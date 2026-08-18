<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme';
	import ProteinViewer from '$lib/components/ProteinViewer.svelte';
	import MsaViewer from '$lib/components/MsaViewer.svelte';
	import MutationHeatmap, { ddgColor as hmDdgColor, rsaColor as hmRsaColor } from '$lib/components/MutationHeatmap.svelte';
	import type { HeatmapRowDef, ColorbarDef } from '$lib/components/MutationHeatmap.svelte';
	import { groupByPosition, type EvolMutationRow, type PositionInfo, type MultipleMutationRow } from '$lib/utils/popmusic';
	import type { Chart as ChartType } from 'chart.js';
	import JobLogs from '$lib/components/JobLogs.svelte';
	import MultipleMutationsTrack from '$lib/components/results/MultipleMutationsTrack.svelte';

	let Chart = $state<typeof ChartType | null>(null);

	interface Props {
		mutations: EvolMutationRow[];
		multipleMutations?: MultipleMutationRow[];
		pdbUrl: string;
		fastaContent: string | null;
		fastaUrl?: string | null;  // alternative to fastaContent: fetched only when Parameters is opened
		zipUrl: string | null;
		lambda: number;
		msaNtot?: number | null;
		sigSlope?: number | null;
		sigCenter?: number | null;
		clipThreshold?: number | null;
		logContent?: string | null;
		title?: string;
		subtitle?: string;
		backUrl?: string;
	}

	let { mutations, multipleMutations = [], pdbUrl, fastaContent, fastaUrl = null, zipUrl, lambda, msaNtot, sigSlope, sigCenter, clipThreshold, logContent, title, subtitle, backUrl }: Props = $props();

	// An MSA weighs a few MB: when only its URL is given, fetch it the first time the
	// Parameters tab is opened instead of making every visitor pay for it
	let lazyFasta = $state<string | null>(null);
	let msaLoading = $state(false);
	let msaError = $state<string | null>(null);
	let msaRequested = false;  // plain flag: guarding with $state would re-trigger the effect
	const msaContent = $derived(fastaContent ?? lazyFasta);

	$effect(() => {
		if (tab !== 'parameters' || fastaContent || !fastaUrl || msaRequested) return;
		msaRequested = true;
		msaLoading = true;
		fetch(fastaUrl)
			.then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((text) => { lazyFasta = text; })
			.catch((e) => { msaError = e instanceof Error ? e.message : 'fetch failed'; })
			.finally(() => { msaLoading = false; });
	});

	const ACCENT = '#6366f1';

	type Tab = 'mutations' | 'multiple' | 'summary' | 'parameters' | 'log';
	type ScoreKey = 'ddg' | 'ddgStr' | 'ddgStrEvol';

	const SCORE_LABELS: Record<ScoreKey, string> = {
		ddg: 'ΔΔG',
		ddgStr: 'ΔΔG (structural)',
		ddgStrEvol: 'ΔΔG (structural+evol)'
	};

	const SS_LABELS: Record<string, string> = {
		H: 'Helix', G: '310-Helix', I: 'π-Helix',
		E: 'Sheet', B: 'Bridge', T: 'Turn', S: 'Bend', C: 'Coil'
	};

	let tab = $state<Tab>('mutations');
	// Model whose mentions are highlighted in the Parameters tab (hover)
	let hl = $state<'str' | 'evol' | null>(null);
	let scoreKey = $state<ScoreKey>('ddg');
	let selectedPosIdx = $state<number | null>(null);
	let expandedPosKeys = $state<Set<number>>(new Set());
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

	function gapColor(v: number, _vmin: number, _vmax: number, _dark: boolean): [number, number, number] {
		const t = Math.max(0, Math.min(1, v));
		return [lerp(50, 220, t), lerp(180, 60, t), lerp(80, 50, t)];
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
		if (scoreKey === 'ddg') return row.ddg;
		if (scoreKey === 'ddgStr') return row.ddgStr;
		return row.ddgStrEvol;
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
			label: 'Gap',
			values: positions.map(p => p.gap_ratio),
			colorFn: gapColor,
			vmin: 0, vmax: 1,
			fmt: v => (v * 100).toFixed(0) + '%'
		},
		{
			label: 'Mean',
			values: positions.map(p =>
				scoreKey === 'ddg' ? p.meanDdg : scoreKey === 'ddgStr' ? p.meanDdgStr : p.meanDdgStrEvol
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
		const allVals = scoreKey === 'ddg'
			? mutations.map(m => m.ddg)
			: scoreKey === 'ddgStr'
				? mutations.map(m => m.ddgStr)
				: mutations.map(m => m.ddgStrEvol);
		if (!allVals.length) return { label: 'ΔΔG (kcal/mol)', vmin: -2, vmax: 2, colorFn: hmDdgColor };
		const mn = Math.max(-5, Math.floor(Math.min(...allVals) * 10) / 10);
		const mx = Math.min(5, Math.ceil(Math.max(...allVals) * 10) / 10);
		return { label: 'ΔΔG (kcal/mol)', vmin: mn, vmax: mx, colorFn: hmDdgColor, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) };
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
			color: ddgHex(p.meanDdg),
			selected: i === selectedPosIdx
		}))
	);

	// ── Table sorting ─────────────────────────────────────────────────────────
	type TableCol = 'pos' | 'RSA' | 'meanDdg' | 'meanDdgStr' | 'meanDdgStrEvol' | 'secStruct' | 'pLDDT' | 'gap_ratio';
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
				case 'pos':            return (a.msaPos - b.msaPos) * dir;
				case 'RSA':            return (a.RSA - b.RSA) * dir;
				case 'meanDdg':        return (a.meanDdg - b.meanDdg) * dir;
				case 'meanDdgStr':     return (a.meanDdgStr - b.meanDdgStr) * dir;
				case 'meanDdgStrEvol': return (a.meanDdgStrEvol - b.meanDdgStrEvol) * dir;
				case 'pLDDT':          return (a.pLDDT - b.pLDDT) * dir;
				case 'gap_ratio':      return (a.gap_ratio - b.gap_ratio) * dir;
				case 'secStruct':      return a.secondary_structure.localeCompare(b.secondary_structure) * dir;
				default: return 0;
			}
		});
	});

	function selectPositionFromTable(pos: PositionInfo) {
		const idx = positions.findIndex(p => p.msaPos === pos.msaPos);
		selectedPosIdx = selectedPosIdx === idx ? null : idx;
	}

	function toggleExpand(pos: PositionInfo) {
		const next = new Set(expandedPosKeys);
		if (next.has(pos.msaPos)) { next.delete(pos.msaPos); } else { next.add(pos.msaPos); }
		expandedPosKeys = next;
	}

	function ddgClass(v: number): string {
		if (v < -0.5) return 'ddg-ss';
		if (v < 0)    return 'ddg-sl';
		if (v < 0.5)  return 'ddg-dl';
		return 'ddg-ds';
	}

	// ── Multiple mutations ────────────────────────────────────────────────────
	// The tool aggregates a multiple mutation as the plain sum of its individual
	// effects, so each expanded row shows the single-mutation contributions.
	const singleByPdbId = $derived(new Map(mutations.map((r) => [r.mutation_pdb, r])));

	type MultiCol = 'mutation' | 'nSites' | 'ddg' | 'ddgStr' | 'ddgStrEvol';
	let multiSort = $state<{ col: MultiCol; dir: 1 | -1 }>({ col: 'ddg', dir: -1 });
	let expandedMultiKeys = $state<Set<string>>(new Set());

	function toggleMultiSort(col: MultiCol) {
		multiSort = multiSort.col === col
			? { col, dir: (multiSort.dir * -1) as 1 | -1 }
			: { col, dir: 1 };
	}

	function toggleMultiExpand(key: string) {
		const next = new Set(expandedMultiKeys);
		if (next.has(key)) { next.delete(key); } else { next.add(key); }
		expandedMultiKeys = next;
	}

	const sortedMultiple = $derived.by(() => {
		const dir = multiSort.dir;
		return [...multipleMutations].sort((a, b) => {
			switch (multiSort.col) {
				case 'nSites':     return (a.sites.length - b.sites.length) * dir;
				case 'ddg':        return (a.ddg - b.ddg) * dir;
				case 'ddgStr':     return (a.ddgStr - b.ddgStr) * dir;
				case 'ddgStrEvol': return (a.ddgStrEvol - b.ddgStrEvol) * dir;
				case 'mutation':   return a.mutation_pdb.localeCompare(b.mutation_pdb) * dir;
				default: return 0;
			}
		});
	});

	function signed(v: number, digits = 2): string {
		return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
	}

	// ── Chart ─────────────────────────────────────────────────────────────────
	let canvasDist = $state<HTMLCanvasElement | undefined>();
	let summaryScoreKey = $state<ScoreKey>('ddg');

	function chartColors() {
		const isDark = $theme === 'dark';
		return {
			text: isDark ? '#94a3b8' : '#64748b',
			grid: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'
		};
	}

	function makeDistChart(canvas: HTMLCanvasElement, muts: EvolMutationRow[], key: ScoreKey, C = Chart!) {
		const c = chartColors();
		const BIN = 0.2, LO = -3, HI = 3;
		const bins: number[] = Array(Math.round((HI - LO) / BIN)).fill(0);
		for (const m of muts) {
			const val = key === 'ddg' ? m.ddg : key === 'ddgStr' ? m.ddgStr : m.ddgStrEvol;
			const i = Math.floor((Math.min(Math.max(val, LO), HI - 0.001) - LO) / BIN);
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
		const key = summaryScoreKey;
		const chart = makeDistChart(canvasDist, mutations, key);
		return () => chart.destroy();
	});

	// ── Sigmoid λ chart ─────────────────────────────────────────────────────────
	const SIG_YMAX = 4.5; // display range (fixed)
	// SVG layout: left=52, top=18, plotW=238, plotH=122, viewBox 390×205
	const SC_L = 52, SC_T = 18, SC_PW = 238, SC_PH = 122;
	const SC_BOT = SC_T + SC_PH; // 140
	const SC_MID_Y = SC_T + SC_PH / 2; // 79

	function spx(lam: number): number { return SC_L + lam * SC_PW; }
	function spy(l10: number): number { return SC_BOT - (l10 / SIG_YMAX) * SC_PH; }

	// Sigmoid params from metadata (fallback to PoPMuSiC defaults)
	const sigR   = $derived(sigSlope  ?? 5.0);
	const sigC   = $derived(sigCenter ?? 1.0);
	const clipThr = $derived(clipThreshold ?? 0.01);

	const sigCurve = $derived.by(() =>
		Array.from({ length: 201 }, (_, i) => {
			const t = (i / 200) * SIG_YMAX;
			const lam = 1 / (1 + Math.exp(-sigR * (t - sigC)));
			return `${i === 0 ? 'M' : 'L'}${spx(lam).toFixed(1)},${spy(t).toFixed(1)}`;
		}).join(' ')
	);

	const dotLog10 = $derived(msaNtot != null && msaNtot > 0 ? Math.min(Math.log10(msaNtot), SIG_YMAX) : 0);
	// dotLam: raw sigmoid value (used for the dot & crosshair on the curve)
	const dotLam        = $derived(1 / (1 + Math.exp(-sigR * (dotLog10 - sigC))));
	// dotLamClipped: clipped value for lambda display only (not shown on curve)
	const dotLamClipped = $derived(dotLam < clipThr ? 0 : dotLam);
	const hasMsaDot = $derived(msaNtot != null && msaNtot > 0);

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
		{#if multipleMutations.length > 0}
			<button class="tab" class:active={tab === 'multiple'} onclick={() => (tab = 'multiple')}>
				Multiple mutations <span class="tab-count">{multipleMutations.length}</span>
			</button>
		{/if}
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
							Computed {SCORE_LABELS[scoreKey]} per position and amino acid substitution — red = destabilizing, green = stabilizing
						</span>
					</div>
					<!-- Score selector -->
					<div class="score-selector">
						{#each (['ddg', 'ddgStr', 'ddgStrEvol'] as ScoreKey[]) as key}
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
						<th class="num sortable" class:sort-active={tableSort.col === 'pLDDT'} onclick={() => toggleSort('pLDDT')}>
							pLDDT <span class="sort-arrow">{tableSort.col === 'pLDDT' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th class="num sortable" class:sort-active={tableSort.col === 'gap_ratio'} onclick={() => toggleSort('gap_ratio')}>
							Gap Ratio <span class="sort-arrow">{tableSort.col === 'gap_ratio' ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						{#each (['ddg', 'ddgStr', 'ddgStrEvol'] as const) as key}
							{@const col = key === 'ddg' ? 'meanDdg' : key === 'ddgStr' ? 'meanDdgStr' : 'meanDdgStrEvol'}
							<th class="num sortable" class:sort-active={tableSort.col === col} onclick={() => toggleSort(col)}>
								Mean {SCORE_LABELS[key]} <span class="sort-arrow">{tableSort.col === col ? (tableSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedPositions as pos}
						{@const posIdx = positions.findIndex(p => p.msaPos === pos.msaPos)}
						{@const isSelected = posIdx === selectedPosIdx}
						{@const isExpanded = expandedPosKeys.has(pos.msaPos)}
						<tr class="pos-row" class:is-sel={isSelected} class:is-expanded={isExpanded}
							onclick={() => toggleExpand(pos)}>
							<td>
								<div class="pos-cell">
									<span class="expand-chevron">{isExpanded ? '▾' : '▸'}</span>
									<button class="pos-label" onclick={(e) => { e.stopPropagation(); selectPositionFromTable(pos); }}>
										{pos.chain}{pos.resNumPdb}
									</button>
								</div>
							</td>
							<td class="aa-cell">{pos.wtAa}</td>
							<td><span class="ss-badge ss-{pos.secondary_structure}">{SS_LABELS[pos.secondary_structure] ?? pos.secondary_structure}</span></td>
							<td class="num">{pos.RSA.toFixed(1)}%</td>
							<td class="num">{pos.pLDDT.toFixed(1)}</td>
							<td class="num">{(pos.gap_ratio * 100).toFixed(1)}%</td>
							<td class="num"><span class="ddg-pill {ddgClass(pos.meanDdg)}">{pos.meanDdg > 0 ? '+' : ''}{pos.meanDdg.toFixed(2)}</span></td>
							<td class="num mono">{pos.meanDdgStr.toFixed(3)}</td>
							<td class="num mono">{pos.meanDdgStrEvol.toFixed(3)}</td>
						</tr>
						{#if isExpanded}
							{#each AA_ORDER as aa}
								{@const row = pos.mutations.get(aa)}
								{#if row && aa !== pos.wtAa}
									<tr class="mut-row">
										<td>
											<div class="mut-label">
												<span class="mut-from">{pos.wtAa}</span>
												<span class="mut-arrow">→</span>
												<span class="mut-to">{aa}</span>
											</div>
										</td>
										<td></td><td></td><td></td><td></td><td></td>
										<td class="num"><span class="ddg-pill {ddgClass(row.ddg)}">{row.ddg > 0 ? '+' : ''}{row.ddg.toFixed(2)}</span></td>
										<td class="num mono">{row.ddgStr.toFixed(3)}</td>
										<td class="num mono">{row.ddgStrEvol.toFixed(3)}</td>
									</tr>
								{/if}
							{/each}
						{/if}
					{/each}
					{#if sortedPositions.length === 0}
						<tr><td colspan="9" class="empty-cell">No data available</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Tab 2: Multiple mutations -->
	{#if tab === 'multiple'}
		<p class="multi-note">
			Each multiple mutation combines several substitutions applied together. Its ΔΔG is the sum
			of the individual effects — expand a row to see each contribution.
		</p>
		<MultipleMutationsTrack
			{positions}
			rows={sortedMultiple}
			expandedKeys={expandedMultiKeys}
			onToggle={toggleMultiExpand}
		/>
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th class="sortable" class:sort-active={multiSort.col === 'mutation'} onclick={() => toggleMultiSort('mutation')}>
							Mutation <span class="sort-arrow">{multiSort.col === 'mutation' ? (multiSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th class="num sortable" class:sort-active={multiSort.col === 'nSites'} onclick={() => toggleMultiSort('nSites')}>
							Sites <span class="sort-arrow">{multiSort.col === 'nSites' ? (multiSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						{#each (['ddg', 'ddgStr', 'ddgStrEvol'] as const) as key}
							<th class="num sortable" class:sort-active={multiSort.col === key} onclick={() => toggleMultiSort(key)}>
								{SCORE_LABELS[key]} <span class="sort-arrow">{multiSort.col === key ? (multiSort.dir === 1 ? '↑' : '↓') : '↕'}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedMultiple as row}
						{@const isExpanded = expandedMultiKeys.has(row.mutation_pdb)}
						<tr class="pos-row" class:is-expanded={isExpanded} onclick={() => toggleMultiExpand(row.mutation_pdb)}>
							<td>
								<div class="pos-cell">
									<span class="expand-chevron">{isExpanded ? '▾' : '▸'}</span>
									<div class="multi-chips">
										{#each row.sites as site}
											<span class="multi-chip">
												<span class="mut-from">{site.wtAa}</span><span
													class="multi-chip-pos">{site.chain}{site.resNumPdb}</span><span
													class="mut-to">{site.mutAa}</span>
											</span>
										{/each}
									</div>
								</div>
							</td>
							<td class="num">{row.sites.length}</td>
							<td class="num"><span class="ddg-pill {ddgClass(row.ddg)}">{signed(row.ddg)}</span></td>
							<td class="num mono">{row.ddgStr.toFixed(3)}</td>
							<td class="num mono">{row.ddgStrEvol.toFixed(3)}</td>
						</tr>
						{#if isExpanded}
							{#each row.sites as site}
								{@const single = singleByPdbId.get(site.mutation_pdb)}
								<tr class="mut-row">
									<td>
										<div class="multi-site">
											<span class="mut-label">
												<span class="mut-from">{site.wtAa}</span>
												<span class="mut-arrow">→</span>
												<span class="mut-to">{site.mutAa}</span>
											</span>
											<span class="multi-site-pos">{site.chain}{site.resNumPdb}</span>
											<span class="ss-badge ss-{site.secondary_structure}">
												{SS_LABELS[site.secondary_structure] ?? site.secondary_structure}
											</span>
											<span class="multi-site-meta">
												RSA {site.RSA.toFixed(1)}% · pLDDT {site.pLDDT.toFixed(1)} · gap {(site.gap_ratio * 100).toFixed(0)}%
											</span>
										</div>
									</td>
									<td></td>
									<td class="num">
										{#if single}
											<span class="ddg-pill {ddgClass(single.ddg)}">{signed(single.ddg)}</span>
										{:else}
											<span class="multi-na">—</span>
										{/if}
									</td>
									<td class="num mono">{single ? single.ddgStr.toFixed(3) : '—'}</td>
									<td class="num mono">{single ? single.ddgStrEvol.toFixed(3) : '—'}</td>
								</tr>
							{/each}
						{/if}
					{/each}
					{#if sortedMultiple.length === 0}
						<tr><td colspan="5" class="empty-cell">No multiple mutations for this analysis</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Tab 3: Summary -->
	{#if tab === 'summary'}
		<div class="chart-card">
			<div class="chart-card-header">
				<div>
					<div class="chart-title">ΔΔG distribution</div>
					<div class="chart-sub">Distribution of all individual mutation effects — green = stabilizing, red = destabilizing</div>
				</div>
				<div class="score-selector">
					{#each (['ddg', 'ddgStr', 'ddgStrEvol'] as ScoreKey[]) as key}
						<button class="score-btn" class:active={summaryScoreKey === key}
							onclick={() => (summaryScoreKey = key)}>{SCORE_LABELS[key]}</button>
					{/each}
				</div>
			</div>
			<div class="chart-wrap">
				<canvas bind:this={canvasDist}></canvas>
			</div>
		</div>
	{/if}

	<!-- Tab 4: Parameters -->
	{#if tab === 'parameters'}
		<div class="params-section">
			<div class="param-card" class:hl-str={hl === 'str'} class:hl-evol={hl === 'evol'}>
				<div class="param-card-title">Model formula</div>

				{#snippet ddgStr(label: string)}
					<span class="tok tok-str" role="term" onmouseenter={() => (hl = 'str')} onmouseleave={() => (hl = null)}
						>{label}ΔΔG<sub>str</sub>{label ? ')' : ''}</span>
				{/snippet}
				{#snippet ddgEvol(label: string)}
					<span class="tok tok-evol" role="term" onmouseenter={() => (hl = 'evol')} onmouseleave={() => (hl = null)}
						>{label}ΔΔG<sub>str+evol</sub>{label ? ')' : ''}</span>
				{/snippet}

				<!-- Explanation on the left, this run's numbers on the right -->
				<div class="param-split">
					<div class="param-explain">
						<p class="param-lead">
							The distinction between the two models allows the predictor to adapt to the amount of
							evolutionary information available for each protein. Final model prediction (ΔΔG) is
							obtained by interpolating between the structure-only model ({@render ddgStr('')}) and the
							structure + evolution model ({@render ddgEvol('')}).
						</p>

						<ul class="param-notes">
							<li>
								{@render ddgStr('Structure-only model (')}: uses physical potential function scores and
								the SaProt score, excluding the StructureDCA score.
							</li>
							<li>
								{@render ddgEvol('Structure + evolution model (')}: uses physical potential function
								scores, the SaProt score, and StructureDCA scores.
							</li>
							<li>
								For proteins with low evolutionary information (few sequences in the MSA), the final
								model relies mostly on {@render ddgStr('')}. For proteins with high evolutionary
								information (many sequences in the MSA), it relies mostly on {@render ddgEvol('')}.
							</li>
							<li>
								The amount of evolutionary information is quantified as log<sub>10</sub>(N<sub>tot</sub>),
								where N<sub>tot</sub> is the total number of sequences in the MSA.
							</li>
						</ul>
					</div>

					<div class="formula-box param-visual">
						<div class="formula-text">
							ΔΔG = (1 &minus; &lambda;) &middot; {@render ddgStr('')} + &lambda; &middot; {@render ddgEvol('')}
						</div>

						<div class="sig-container">
							<svg class="sig-svg" viewBox="0 0 390 205" xmlns="http://www.w3.org/2000/svg">
							<defs>
								<!-- The curve sweeps from one model to the other, like λ does -->
								<linearGradient id="sigGrad" x1="0" y1="0" x2="1" y2="0">
									<stop offset="0%"   stop-color="var(--c-str)"/>
									<stop offset="100%" stop-color="var(--c-evol)"/>
								</linearGradient>
							</defs>
							<g transform="translate(24, 0)">
								<!-- half of the plot the hovered model dominates -->
								{#if hl}
									<rect x={hl === 'str' ? SC_L : SC_L + SC_PW / 2} y={SC_T}
										  width={SC_PW / 2} height={SC_BOT - SC_T}
										  fill={hl === 'str' ? 'var(--c-str)' : 'var(--c-evol)'} opacity="0.09"/>
								{/if}
								<!-- grid -->
								{#each [1, 2, 3, 4] as t}
									<line x1={SC_L} y1={spy(t)} x2={SC_L + SC_PW} y2={spy(t)} stroke="var(--border)" stroke-width="0.5"/>
								{/each}
								<!-- crosshairs -->
								{#if hasMsaDot}
									<line x1={SC_L} y1={spy(dotLog10)} x2={spx(dotLam)} y2={spy(dotLog10)}
										  stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="4,3" opacity="0.55"/>
									<line x1={spx(dotLam)} y1={spy(dotLog10)} x2={spx(dotLam)} y2={SC_BOT}
										  stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="4,3" opacity="0.55"/>
								{/if}
								<!-- sigmoid curve -->
								<path d={sigCurve} fill="none" stroke="url(#sigGrad)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
								<!-- dots -->
								{#if hasMsaDot}
									<circle cx={SC_L}         cy={spy(dotLog10)} r="3.5" fill="var(--text-muted)" opacity="0.6"/>
									<circle cx={spx(dotLam)}  cy={SC_BOT}        r="3.5" fill="var(--text-muted)" opacity="0.6"/>
									<circle cx={spx(dotLam)}  cy={spy(dotLog10)} r="4.5" fill="var(--accent)"/>
								{/if}
								<!-- axes -->
								<line x1={SC_L} y1={SC_T}   x2={SC_L}         y2={SC_BOT} stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="square"/>
								<line x1={SC_L} y1={SC_BOT} x2={SC_L + SC_PW} y2={SC_BOT} stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="square"/>
								<!-- Y ticks + labels -->
								{#each [0, 1, 2, 3, 4] as t}
									<line x1={SC_L - 4} y1={spy(t)} x2={SC_L} y2={spy(t)} stroke="var(--text-muted)" stroke-width="1.5"/>
									<text x={SC_L - 7} y={spy(t)} text-anchor="end" dominant-baseline="middle" font-size="9.5" fill="var(--text-muted)">{t}</text>
								{/each}
								<!-- Y axis label -->
								<text x={10} y={SC_MID_Y} text-anchor="middle" dominant-baseline="middle"
									  font-size="10" fill="var(--text-muted)" transform="rotate(-90, 10, {SC_MID_Y})">log₁₀(Nₜₒₜ)</text>
								<!-- X ticks + labels -->
								{#each [0, 0.25, 0.5, 0.75, 1] as t}
									<line x1={spx(t)} y1={SC_BOT} x2={spx(t)} y2={SC_BOT + 4} stroke="var(--text-muted)" stroke-width="1.5"/>
									<text x={spx(t)} y={SC_BOT + 15} text-anchor="middle" font-size="9.5" fill="var(--text-muted)">{t}</text>
								{/each}
								<!-- X axis label (λ) -->
								<text x={171} y={SC_BOT + 30} text-anchor="middle" font-size="12" fill="var(--text-muted)" font-style="italic">λ</text>
								<!-- ΔΔG endpoint labels: same colors as in the text -->
								<text class="end-str"  x={SC_L}         y={SC_BOT + 47} text-anchor="middle" font-size="9.5">ΔΔG<tspan dy="2" font-size="7.5">str</tspan></text>
								<text class="end-evol" x={SC_L + SC_PW} y={SC_BOT + 47} text-anchor="middle" font-size="9.5">ΔΔG<tspan dy="2" font-size="7.5">str+evol</tspan></text>
								<!-- corner labels: the two ends of the evolutionary information axis -->
								<text class="end-str"  x={SC_L + 6} y={SC_BOT - 6} font-size="8.5" opacity="0.75">No MSA</text>
								<text class="end-evol" x={SC_L + 6} y={SC_T + 14}  font-size="8.5" opacity="0.75">Deep MSA</text>
							</g>
							</svg>
							{#if hasMsaDot}
								<div class="sig-vals">
									<span>N<sub>tot</sub> = <code>{msaNtot?.toLocaleString()}</code></span>
									<span class="sig-sep">·</span>
									<span>log₁₀(N<sub>tot</sub>) = <code>{dotLog10.toFixed(3)}</code></span>
									<span class="sig-sep">·</span>
									<span>λ = <code>{dotLamClipped.toFixed(3)}</code></span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="param-card">
				<div class="param-card-head">
					<div class="param-card-title">Multiple sequence alignment</div>
					{#if hasMsaDot}
						<span class="param-card-note">
							N<sub>tot</sub> = {msaNtot?.toLocaleString()} sequences — the count λ is derived from
						</span>
					{/if}
				</div>
				{#if msaContent}
					<MsaViewer {msaContent} />
				{:else if msaLoading}
					<p class="param-empty">Loading alignment…</p>
				{:else if msaError}
					<p class="param-empty">Could not load the alignment: {msaError}</p>
				{:else}
					<p class="param-empty">No alignment file available for this run.</p>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Tab 5: Log -->
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
	.page { max-width: var(--page-max); margin: 0 auto; padding: 2.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; }

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
	.pos-row.is-expanded { background: color-mix(in srgb, var(--accent) 5%, transparent); }
	.pos-cell { display: flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
	.expand-chevron { font-size: 0.65rem; color: var(--text-muted); width: 12px; flex-shrink: 0; }
	.pos-label { background: none; border: none; font-family: monospace; font-size: 0.875rem; color: var(--text); cursor: pointer; padding: 0; text-underline-offset: 2px; }
	.pos-label:hover { color: var(--accent); text-decoration: underline; }
	.aa-cell { font-family: monospace; font-weight: 700; font-size: 1rem; }
	/* Mutation sub-rows */
	.mut-row { background: color-mix(in srgb, var(--bg) 60%, var(--surface)); }
	.mut-row:hover { background: color-mix(in srgb, var(--accent) 3%, var(--bg)); }
	.mut-row td { padding: 0.28rem 0.875rem; border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent); font-size: 0.82rem; }
	.mut-label { display: flex; align-items: center; gap: 0.3rem; padding-left: 1.6rem; font-family: monospace; }
	.mut-from { color: var(--text-muted); font-weight: 600; }
	.mut-arrow { color: var(--text-muted); opacity: 0.5; font-size: 0.75rem; }
	.mut-to { color: var(--text); font-weight: 700; }

	/* Multiple mutations tab */
	.multi-note { font-size: 0.8rem; color: var(--text-muted); line-height: 1.55; margin: 0 0 0.875rem; }
	.multi-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
	.multi-chip { display: inline-flex; align-items: baseline; font-family: monospace; font-size: 0.82rem; background: color-mix(in srgb, var(--accent) 9%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent); border-radius: 0.25rem; padding: 0.08rem 0.4rem; }
	.multi-chip-pos { color: var(--text-muted); font-size: 0.74rem; margin: 0 0.15rem; }
	.multi-site { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; }
	.multi-site-pos { font-family: monospace; font-size: 0.8rem; color: var(--text-muted); }
	.multi-site-meta { font-size: 0.72rem; color: var(--text-muted); opacity: 0.75; }
	.multi-na { color: var(--text-muted); }
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
	.chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.chart-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
	.chart-title { font-size: 0.82rem; font-weight: 600; color: var(--text); }
	.chart-sub { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem; }
	.chart-wrap { position: relative; height: 300px; margin-top: 0.75rem; }
	.chart-wrap canvas { width: 100% !important; height: 100% !important; }

	/* Parameters tab */
	.params-section { display: flex; flex-direction: column; gap: 1.5rem; }
	.param-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
	.param-card-title { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
	.formula-box { display: flex; flex-direction: column; gap: 1.25rem; align-items: center; }
	.formula-text { font-size: 1.05rem; font-family: 'Georgia', serif; color: var(--text); padding: 0.75rem 1.25rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.5rem; display: inline-block; }
	.formula-text sub { font-size: 0.65em; }
	.sig-container { display: flex; flex-direction: column; gap: 0.5rem; align-self: stretch; align-items: center; }
	.sig-svg { width: 100%; max-width: 420px; height: auto; }
	.sig-vals { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-muted); justify-content: center; }
	.sig-vals code { font-family: monospace; font-size: 0.8rem; color: var(--text); }
	.sig-sep { opacity: 0.4; }
	:global(:root[data-theme='dark']) .params-section { --c-str: #fbbf24; --c-evol: #a5b4fc; }
	.param-lead { font-size: 0.88rem; line-height: 1.65; color: var(--text-muted); margin: 0; }
	.param-split { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 3fr); gap: 1.5rem 2.5rem; align-items: center; }
	.param-explain { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
	.param-visual { min-width: 0; }
	@media (max-width: 980px) { .param-split { grid-template-columns: 1fr; align-items: start; } }
	.param-lead sub, .param-notes sub, .param-card-note sub, .tok sub { font-size: 0.7em; }
	.param-notes { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.84rem; line-height: 1.65; color: var(--text-muted); }

	/* Colour code tying every mention of a model to its end of the λ axis */
	.params-section { --c-str: #b45309; --c-evol: #4f46e5; }
	.tok { color: var(--c-str); font-weight: 600; border-radius: 0.25rem; padding: 0.05rem 0.2rem; margin: 0 -0.2rem; cursor: help; transition: background 0.15s, opacity 0.15s; }
	.tok-evol { color: var(--c-evol); }
	.hl-str .tok-str  { background: color-mix(in srgb, var(--c-str) 18%, transparent); }
	.hl-evol .tok-evol { background: color-mix(in srgb, var(--c-evol) 18%, transparent); }
	.hl-str .tok-evol, .hl-evol .tok-str { opacity: 0.3; }
	.end-str  { fill: var(--c-str); }
	.end-evol { fill: var(--c-evol); }
	.hl-str .end-evol, .hl-evol .end-str { opacity: 0.25; }
	.formula-text .tok { font-weight: inherit; white-space: nowrap; }
	.param-card-head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
	.param-card-note { font-size: 0.75rem; color: var(--text-muted); opacity: 0.8; }
	.param-empty { font-size: 0.82rem; color: var(--text-muted); margin: 0; }

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
