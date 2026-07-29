<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme';
	import PdbMetadata from '$lib/components/pdb/PdbMetadata.svelte';
	import ProteinViewer from '$lib/components/ProteinViewer.svelte';
	import MutationHeatmap, { dtmColor, rsaColor } from '$lib/components/MutationHeatmap.svelte';
	import type { HeatmapRowDef, ColorbarDef } from '$lib/components/MutationHeatmap.svelte';
	import type { HotSummaryRow, HotMutationRow } from '$lib/utils/hotmusic';
	import type { Chart as ChartType } from 'chart.js';
	import type { PdbMetadata as PdbMeta } from '$lib/utils/pdb';
	import JobLogs from '$lib/components/JobLogs.svelte';

	let Chart = $state<typeof ChartType | null>(null);

	interface Props {
		summary: HotSummaryRow[];
		mutations: HotMutationRow[];
		meta: PdbMeta;
		pdbUrl: string;
		downloadUrls: { hot: string | null; hots: string | null; pdb: string | null };
		logContent?: string | null;
		title?: string;
		subtitle?: string;
		backUrl?: string;
	}

	let { summary, mutations, meta, pdbUrl, downloadUrls, logContent = null, title, subtitle, backUrl }: Props = $props();

	const ACCENT = '#f59e0b';

	const displayTitle    = $derived(title    ?? meta.id);
	const displaySubtitle = $derived(subtitle ?? '');

	const SS_LABELS: Record<string, string> = {
		H: 'Helix (H)', G: '310-Helix (G)', I: 'π-Helix (I)',
		E: 'Sheet (E)', B: 'Bridge (B)', T: 'Turn (T)', S: 'Bend (S)', C: 'Coil (C)'
	};

	const AA_ORDER = ['A','C','D','E','F','G','H','I','K','L','M','N','P','Q','R','S','T','V','W','Y'];
	const AA1_TO_3: Record<string, string> = {
		A:'ALA',C:'CYS',D:'ASP',E:'GLU',F:'PHE',G:'GLY',H:'HIS',I:'ILE',K:'LYS',L:'LEU',
		M:'MET',N:'ASN',P:'PRO',Q:'GLN',R:'ARG',S:'SER',T:'THR',V:'VAL',W:'TRP',Y:'TYR'
	};

	// ── Color helpers ────────────────────────────────────────────────────────
	// Negative ΔTm → green, positive ΔTm → red.
	function dtmHex(v: number): string {
		if (v > 0.5)  return '#ef4444';
		if (v > 0)    return '#fb923c';
		if (v > -0.5) return '#86efac';
		return '#22c55e';
	}

	function dtmColorChart(v: number, alpha = 0.85): string {
		if (v > 0.5)  return `rgba(239,68,68,${alpha})`;
		if (v > 0)    return `rgba(251,146,60,${alpha})`;
		if (v > -0.5) return `rgba(134,239,172,${alpha})`;
		return `rgba(34,197,94,${alpha})`;
	}

	// Heatmap colorFn: negative ΔTm → green, positive ΔTm → red
	function hmDtmColor(v: number, vmin: number, vmax: number, dark: boolean): [number, number, number] {
		return dtmColor(v, vmin, vmax, dark);
	}

	function dtmClass(v: number): string {
		if (v > 0.5)  return 'dtm-ss';
		if (v > 0)    return 'dtm-sl';
		if (v > -0.5) return 'dtm-dl';
		return 'dtm-ds';
	}

	// ── Derived filters ──────────────────────────────────────────────────────
	const allChains = $derived([...new Set(summary.map((r) => r.chain))].sort());
	const allSS     = $derived([...new Set(summary.map((r) => r.secStruct))].sort());
	const rawMin    = $derived(Math.floor(Math.min(...summary.map((r) => r.avgDtm)) * 10) / 10);
	const rawMax    = $derived(Math.ceil(Math.max(...summary.map((r) => r.avgDtm)) * 10) / 10);

	let _chains  = $state<string[] | null>(null);
	let _structs = $state<string[] | null>(null);
	let _dtmMin  = $state<number | null>(null);
	let _dtmMax  = $state<number | null>(null);
	let search   = $state('');
	let expanded = $state<string | null>(null);
	let sortDir  = $state<1 | -1>(1);
	let showDownload = $state(false);

	type Tab = 'summary' | 'mutations' | 'log';
	let tab = $state<Tab>('summary');

	const chains  = $derived(_chains  ?? allChains);
	const structs = $derived(_structs ?? allSS);
	const dtmMin  = $derived(_dtmMin  ?? rawMin);
	const dtmMax  = $derived(_dtmMax  ?? rawMax);

	type SummaryCol = 'position' | 'accessibility' | 'avgDtm' | 'sumNegDtm' | 'sumPosDtm';
	let summarySort = $state<{ col: SummaryCol; dir: 1 | -1 }>({ col: 'position', dir: 1 });
	function toggleSummarySort(col: SummaryCol) {
		summarySort = summarySort.col === col
			? { col, dir: (summarySort.dir * -1) as 1 | -1 }
			: { col, dir: 1 };
	}

	function cmpSummary(a: HotSummaryRow, b: HotSummaryRow, col: SummaryCol, dir: 1 | -1): number {
		if (col === 'position') return (a.chain.localeCompare(b.chain) || a.resNum - b.resNum) * dir;
		return (a[col] - b[col]) * dir;
	}

	const filteredSummary = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = summary.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				r.avgDtm >= dtmMin && r.avgDtm <= dtmMax &&
				(!q || r.resName.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => cmpSummary(a, b, summarySort.col, summarySort.dir));
	});

	const filteredMutations = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = mutations.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				(!q || r.wtRes.toLowerCase().includes(q) || r.mutRes.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => (a.dtm - b.dtm) * sortDir);
	});

	$effect(() => { void chains, structs, dtmMin, dtmMax, search; expanded = null; });

	function toggleChain(c: string) {
		const cur = chains;
		_chains = cur.includes(c) ? (cur.length > 1 ? cur.filter((x) => x !== c) : cur) : [...cur, c];
	}
	function toggleStruct(s: string) {
		const cur = structs;
		_structs = cur.includes(s) ? (cur.length > 1 ? cur.filter((x) => x !== s) : cur) : [...cur, s];
	}

	// ── Per-position mutations map ───────────────────────────────────────────
	const mutationsByPos = $derived.by(() => {
		const map = new Map<string, HotMutationRow[]>();
		for (const m of mutations) {
			const key = `${m.chain}-${m.resNum}`;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(m);
		}
		for (const arr of map.values()) arr.sort((a, b) => a.dtm - b.dtm);
		return map;
	});

	function rowKey(r: HotSummaryRow): string { return `${r.chain}-${r.resNum}`; }
	const BAR_MAX = 3;
	function barPct(dtm: number): string { return `${Math.min((Math.abs(dtm) / BAR_MAX) * 50, 50)}%`; }

	// ── Heatmap ──────────────────────────────────────────────────────────────
	const hmSummary = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = summary.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				r.avgDtm >= dtmMin && r.avgDtm <= dtmMax &&
				(!q || r.resName.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => a.chain.localeCompare(b.chain) || a.resNum - b.resNum);
	});

	const hmSlots = $derived.by(() => {
		const byChain = new Map<string, HotSummaryRow[]>();
		for (const r of hmSummary) {
			if (!byChain.has(r.chain)) byChain.set(r.chain, []);
			byChain.get(r.chain)!.push(r);
		}
		const positions: string[] = [];
		const slots: (HotSummaryRow | null)[] = [];
		for (const chain of [...byChain.keys()].sort()) {
			const rows = byChain.get(chain)!;
			const minRes = rows[0].resNum;
			const maxRes = rows[rows.length - 1].resNum;
			const byNum = new Map(rows.map((r) => [r.resNum, r]));
			for (let num = minRes; num <= maxRes; num++) {
				positions.push(`${chain}${num}`);
				slots.push(byNum.get(num) ?? null);
			}
		}
		return { positions, slots };
	});

	const hmPositions = $derived(hmSlots.positions);

	const mutByPosAA = $derived.by(() => {
		const map = new Map<string, Map<string, number>>();
		for (const m of mutations) {
			const key = `${m.chain}-${m.resNum}`;
			if (!map.has(key)) map.set(key, new Map());
			map.get(key)!.set(m.mutRes, m.dtm);
		}
		return map;
	});

	const hmHeaderRows = $derived<HeatmapRowDef[]>([
		{
			label: 'RSA',
			values: hmSlots.slots.map((r) => r?.accessibility ?? null),
			colorFn: rsaColor,
			vmin: 0, vmax: 100,
			fmt: (v) => v.toFixed(0),
		},
		{
			label: 'Seq. Opt.',
			values: hmSlots.slots.map((r) => r?.sumPosDtm ?? null),
			colorFn: hmDtmColor,
			fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2),
		},
	]);

	const hmDataRows = $derived<HeatmapRowDef[]>(
		AA_ORDER.map((aa1) => {
			const aa3 = AA1_TO_3[aa1];
			return {
				label: aa1,
				values: hmSlots.slots.map((r) => {
					if (!r) return null;
					if (r.resName === aa3) return null;
					const posKey = `${r.chain}-${r.resNum}`;
					return mutByPosAA.get(posKey)?.get(aa3) ?? null;
				}),
				colorFn: hmDtmColor,
				fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2),
			};
		})
	);

	const hmGapIndices = $derived(
		new Set(
			hmSlots.slots
				.map((s, i) => (s === null ? i : -1))
				.filter((i) => i >= 0)
		)
	);

	const hmColorbar = $derived<ColorbarDef>({
		label: 'ΔTm (K)',
		vmin: Math.max(-5, Math.floor(Math.min(...mutations.map((m) => m.dtm)) * 10) / 10),
		vmax: Math.min(5,  Math.ceil( Math.max(...mutations.map((m) => m.dtm)) * 10) / 10),
		colorFn: hmDtmColor,
		fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1),
	});

	// ── 3D viewer ────────────────────────────────────────────────────────────
	let selectedResidues = $state(new Set<string>());

	// Default (before the user touches the Avg ΔTm filter) shows only stabilizing residues.
	const viewerResidues = $derived(
		(_dtmMin === null && _dtmMax === null
			? filteredSummary.filter((r) => r.avgDtm > 0)
			: filteredSummary
		).map((r) => ({
			chain: r.chain,
			resNum: r.resNum,
			color: dtmHex(r.avgDtm),
			selected: selectedResidues.has(rowKey(r))
		}))
	);

	function toggleResidue(key: string) {
		const next = new Set(selectedResidues);
		if (next.has(key)) next.delete(key); else next.add(key);
		selectedResidues = next;
	}

	// ── Charts ───────────────────────────────────────────────────────────────
	let canvasProfile = $state<HTMLCanvasElement | undefined>();
	let canvasDist    = $state<HTMLCanvasElement | undefined>();

	type ModalChart = 'profile' | 'dist';
	let modalChart  = $state<ModalChart | null>(null);
	let canvasModal = $state<HTMLCanvasElement | undefined>();

	const MODAL_TITLES: Record<ModalChart, string> = {
		profile: 'Mutation sensitivity profile',
		dist:    'ΔTm distribution',
	};

	// ── Profile zoom state (wheel + drag) ───────────────────────────────────
	let modalZoomStart = $state(0);
	let modalZoomSize  = $state<number | null>(null);
	let isDragging     = $state(false);
	let dragStartX = 0;
	let dragStartIdx = 0;

	$effect(() => { if (modalChart) { modalZoomStart = 0; modalZoomSize = null; } });

	const modalProfileData = $derived.by(() => {
		if (modalZoomSize === null) return filteredSummary;
		const end = Math.min(modalZoomStart + modalZoomSize, filteredSummary.length);
		return filteredSummary.slice(modalZoomStart, end);
	});

	const PAD_LEFT = 55;
	const PAD_RIGHT = 20;

	function onModalWheel(e: WheelEvent) {
		if (modalChart !== 'profile') return;
		e.preventDefault();
		const total = filteredSummary.length;
		const curSize = modalZoomSize ?? total;
		const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
		const plotW = rect.width - PAD_LEFT - PAD_RIGHT;
		const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left - PAD_LEFT) / plotW));
		const cursorIdx = modalZoomStart + fraction * curSize;
		const factor = e.deltaY > 0 ? 1.4 : 0.7;
		const newSize = Math.max(10, Math.min(total, Math.round(curSize * factor)));
		if (newSize >= total) { modalZoomSize = null; modalZoomStart = 0; return; }
		let newStart = Math.round(cursorIdx - fraction * newSize);
		modalZoomStart = Math.max(0, Math.min(total - newSize, newStart));
		modalZoomSize = newSize;
	}

	function onModalPointerDown(e: PointerEvent) {
		if (modalChart !== 'profile' || modalZoomSize === null) return;
		isDragging = true;
		dragStartX = e.clientX;
		dragStartIdx = modalZoomStart;
		(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
	}

	function onModalPointerMove(e: PointerEvent) {
		if (!isDragging || modalZoomSize === null) return;
		const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
		const plotW = rect.width - PAD_LEFT - PAD_RIGHT;
		const pxPerPos = plotW / modalZoomSize;
		const delta = Math.round((e.clientX - dragStartX) / pxPerPos);
		modalZoomStart = Math.max(0, Math.min(filteredSummary.length - modalZoomSize, dragStartIdx - delta));
	}

	function onModalPointerUp() { isDragging = false; }

	function onModalDblClick() {
		if (modalChart !== 'profile') return;
		modalZoomSize = null; modalZoomStart = 0;
	}

	function chartColors() {
		const isDark = $theme === 'dark';
		return {
			text: isDark ? '#94a3b8' : '#64748b',
			grid: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
			zero: isDark ? 'rgba(255,255,255,0.2)' : '#94a3b8',
		};
	}

	function makeProfileChart(canvas: HTMLCanvasElement, rows: HotSummaryRow[], C = Chart!) {
		const c = chartColors();
		return new C(canvas, {
			type: 'bar',
			data: {
				labels: rows.map((r) => `${r.chain}${r.resNum}`),
				datasets: [{ data: rows.map((r) => r.sumPosDtm), backgroundColor: rows.map((r) => dtmColorChart(r.sumPosDtm)), borderWidth: 0, barPercentage: 0.85 }]
			},
			options: {
				responsive: true, maintainAspectRatio: false, animation: false,
				plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${(ctx.raw as number) > 0 ? '+' : ''}${(ctx.raw as number).toFixed(2)} K` } } },
				scales: {
					x: { ticks: { color: c.text, maxTicksLimit: 15, font: { size: 11 } }, grid: { display: false } },
					y: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid }, border: { color: c.zero }, title: { display: true, text: 'Sum of positive ΔTm (K)', color: c.text, font: { size: 11 } } }
				}
			}
		});
	}

	function makeDistChart(canvas: HTMLCanvasElement, muts: HotMutationRow[], C = Chart!) {
		const c = chartColors();
		const BIN = 0.5, LO = -5, HI = 5;
		const bins: number[] = Array(Math.round((HI - LO) / BIN)).fill(0);
		for (const m of muts) {
			const i = Math.floor((Math.min(Math.max(m.dtm, LO), HI - 0.001) - LO) / BIN);
			bins[i]++;
		}
		const labels = bins.map((_, i) => (LO + i * BIN).toFixed(1));
		return new C(canvas, {
			type: 'bar',
			data: { labels, datasets: [{ data: bins, backgroundColor: labels.map((l) => parseFloat(l) < 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'), borderWidth: 0, barPercentage: 1.0, categoryPercentage: 1.0 }] },
			options: {
				responsive: true, maintainAspectRatio: false, animation: false,
				plugins: { legend: { display: false }, tooltip: { callbacks: { title: (ctx) => `ΔTm ≈ ${ctx[0].label} K`, label: (ctx) => ` ${ctx.raw} mutations` } } },
				scales: {
					x: { ticks: { color: c.text, maxTicksLimit: 12, font: { size: 11 } }, grid: { display: false }, title: { display: true, text: 'ΔTm (K)', color: c.text, font: { size: 11 } } },
					y: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid }, title: { display: true, text: 'Mutations', color: c.text, font: { size: 11 } } }
				}
			}
		});
	}

	$effect(() => { if (!Chart || !canvasProfile) return; const rows = filteredSummary; void $theme; const chart = makeProfileChart(canvasProfile, rows); return () => chart.destroy(); });
	$effect(() => { if (!Chart || !canvasDist) return; const muts = filteredMutations; void $theme; const chart = makeDistChart(canvasDist, muts); return () => chart.destroy(); });
	$effect(() => {
		if (!Chart || !canvasModal || !modalChart) return;
		void $theme;
		const chart = modalChart === 'profile' ? makeProfileChart(canvasModal, modalProfileData)
			: makeDistChart(canvasModal, filteredMutations);
		return () => chart.destroy();
	});

	onMount(() => {
		import('chart.js').then(({ Chart: C, registerables }) => {
			C.register(...registerables);
			Chart = C as unknown as typeof ChartType;
		});
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') modalChart = null; };
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<div class="page" style="--accent: {ACCENT}">
	<!-- Header -->
	<div class="header">
		<div class="header-left">
			<span class="tool-badge">HoTMuSiC</span>
			<div>
				<h1 class="page-title">{displayTitle}</h1>
				{#if displaySubtitle}<span class="page-sub">{displaySubtitle}</span>{/if}
			</div>
		</div>
		<div class="header-actions">
			<div class="dl-wrap">
				<button class="action-btn dl-btn" onclick={() => (showDownload = !showDownload)}>↓ Download</button>
				{#if showDownload}
					<div class="dl-menu">
						{#if downloadUrls.hots}
							<a href={downloadUrls.hots} class="dl-item">
								<span class="dl-ext">.hots</span> Position summary
							</a>
						{/if}
						{#if downloadUrls.hot}
							<a href={downloadUrls.hot} class="dl-item">
								<span class="dl-ext">.hot</span> All mutations
							</a>
						{/if}
						{#if downloadUrls.pdb}
							<a href={downloadUrls.pdb} class="dl-item">
								<span class="dl-ext">.pdb</span> Structure file
							</a>
						{/if}
					</div>
				{/if}
			</div>
			{#if backUrl}
				<a href={backUrl} class="action-btn">New analysis</a>
			{/if}
		</div>
	</div>

	<PdbMetadata {meta} selectedChains={meta.chains} accent={ACCENT} />

	<!-- Tabs -->
	<div class="tabs">
		<button class="tab" class:active={tab === 'summary'} onclick={() => (tab = 'summary')}>
			Summary <span class="tab-count">{filteredSummary.length} positions</span>
		</button>
		<button class="tab" class:active={tab === 'mutations'} onclick={() => (tab = 'mutations')}>
			All mutations <span class="tab-count">{filteredMutations.length}</span>
		</button>
		{#if logContent}
			<button class="tab" class:active={tab === 'log'} onclick={() => (tab = 'log')}>
				Log
			</button>
		{/if}
	</div>

	<!-- Filters -->
	<div class="filters">
		{#if allChains.length > 1}
			<div class="filter-group">
				<span class="filter-label">Chain</span>
				<div class="pills">
					{#each allChains as c}
						<button class="pill" class:active={chains.includes(c)} onclick={() => toggleChain(c)}>{c}</button>
					{/each}
				</div>
			</div>
		{/if}
		<div class="filter-group">
			<span class="filter-label">Structure</span>
			<div class="pills">
				{#each allSS as s}
					<button class="pill" class:active={structs.includes(s)} onclick={() => toggleStruct(s)}>{SS_LABELS[s] ?? s}</button>
				{/each}
			</div>
		</div>
		{#if tab === 'summary'}
			<div class="filter-group">
				<span class="filter-label">Avg ΔTm</span>
				<div class="range-row">
					<input type="number" class="range-input" value={dtmMin} step="0.1" min={rawMin} max={dtmMax} oninput={(e) => (_dtmMin = parseFloat(e.currentTarget.value))} />
					<span class="range-sep">to</span>
					<input type="number" class="range-input" value={dtmMax} step="0.1" min={dtmMin} max={rawMax} oninput={(e) => (_dtmMax = parseFloat(e.currentTarget.value))} />
					<span class="range-unit">K</span>
				</div>
			</div>
		{/if}
		<div class="filter-group">
			<span class="filter-label">Residue</span>
			<input type="search" class="search-input" bind:value={search} placeholder={tab === 'summary' ? 'e.g. ARG' : 'WT or mutant'} />
		</div>
	</div>

	<!-- Summary tab -->
	{#if tab === 'summary'}
		<div class="charts-section">
			<div class="charts-grid">
				<div class="chart-card chart-clickable" role="button" tabindex="0"
					onclick={() => (modalChart = 'profile')}
					onkeydown={(e) => e.key === 'Enter' && (modalChart = 'profile')}
				>
					<div class="chart-card-header">
						<div class="chart-title">Mutation sensitivity profile</div>
						<span class="chart-expand-hint">⤢ expand</span>
					</div>
					<div class="chart-sub">Sum of positive ΔTm per position — peaks highlight positions tolerant to stabilizing mutations</div>
					<div class="chart-wrap"><canvas bind:this={canvasProfile}></canvas></div>
				</div>

				<div class="chart-card viewer-card">
					<div class="chart-card-header">
						<div class="chart-title">3D structure</div>
						{#if selectedResidues.size > 0}
							<button class="viewer-clear" onclick={() => (selectedResidues = new Set())}>Clear ({selectedResidues.size})</button>
						{/if}
					</div>
					<div class="chart-sub">Stabilizing residues shown by default — adjust the Avg ΔTm filter to change</div>
					<div style="margin-top: 0.5rem;">
						<ProteinViewer {pdbUrl} residues={viewerResidues} height="230px" />
					</div>
				</div>

				<div class="chart-card chart-clickable" role="button" tabindex="0"
					onclick={() => (modalChart = 'dist')}
					onkeydown={(e) => e.key === 'Enter' && (modalChart = 'dist')}
				>
					<div class="chart-card-header">
						<div class="chart-title">ΔTm distribution</div>
						<span class="chart-expand-hint">⤢ expand</span>
					</div>
					<div class="chart-sub">Distribution of all individual mutation effects — most mutations are destabilizing</div>
					<div class="chart-wrap"><canvas bind:this={canvasDist}></canvas></div>
				</div>
			</div>
		</div>

		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th class="cb-col">3D</th>
						<th class="sortable" class:sort-active={summarySort.col === 'position'} onclick={() => toggleSummarySort('position')}>
							Position <span class="sort-arrow">{summarySort.col === 'position' ? (summarySort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th>Residue</th>
						<th>Sec. Structure</th>
						{#each ([['accessibility', 'RSA'], ['avgDtm', 'Avg ΔTm'], ['sumNegDtm', 'Σ Destabilizing'], ['sumPosDtm', 'Σ Stabilizing']] as const) as [col, label]}
							<th class="num sortable" class:sort-active={summarySort.col === col} onclick={() => toggleSummarySort(col)}>
								{label} <span class="sort-arrow">{summarySort.col === col ? (summarySort.dir === 1 ? '↑' : '↓') : '↕'}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each filteredSummary as row (rowKey(row))}
						{@const key = rowKey(row)}
						{@const isOpen = expanded === key}
						{@const isSel = selectedResidues.has(key)}
						{@const posMuts = mutationsByPos.get(key) ?? []}
						<tr class="summary-row" class:is-open={isOpen} class:is-sel={isSel} onclick={() => (expanded = isOpen ? null : key)}>
							<td class="cb-col" onclick={(e) => { e.stopPropagation(); toggleResidue(key); }}>
								<input type="checkbox" checked={isSel} aria-label="Highlight in 3D viewer" onclick={(e) => e.stopPropagation()} onchange={() => toggleResidue(key)} />
							</td>
							<td class="pos-cell"><span class="expand-icon">{isOpen ? '▾' : '▸'}</span>{row.chain}{row.resNum}</td>
							<td class="res-cell">{row.resName}</td>
							<td><span class="ss-badge ss-{row.secStruct}">{SS_LABELS[row.secStruct] ?? row.secStruct}</span></td>
							<td class="num">{row.accessibility.toFixed(1)}%</td>
							<td class="num">{row.avgDtm > 0 ? '+' : ''}{row.avgDtm.toFixed(2)} K</td>
							<td class="num green-val">{row.sumNegDtm.toFixed(2)}</td>
							<td class="num"><span class="dtm-pill {dtmClass(row.sumPosDtm)}">{row.sumPosDtm > 0 ? '+' : ''}{row.sumPosDtm.toFixed(2)}</span></td>
						</tr>
						{#if isOpen}
							<tr class="detail-row">
								<td colspan="8">
									<div class="detail-panel">
										<div class="detail-header">
											<strong>{row.resName} {row.chain}{row.resNum}</strong>
											— {posMuts.length} mutations · {SS_LABELS[row.secStruct] ?? row.secStruct} · {row.accessibility.toFixed(1)}% accessibility
										</div>
										<div class="bar-chart-wrap">
											<div class="bar-chart">
												{#each posMuts as mut}
													<div class="bar-row">
														<span class="bar-label">{row.resName.slice(0,1)}{row.resNum}{mut.mutRes.slice(0,1)}</span>
														<span class="bar-mutname">{mut.mutRes}</span>
														<div class="bar-track">
															<div class="bar-center-line"></div>
															<div class="bar-fill {mut.dtm > 0 ? 'bar-pos' : 'bar-neg'}" style="{mut.dtm > 0 ? 'left:50%' : 'right:50%'}; width:{barPct(mut.dtm)}"></div>
														</div>
														<span class="bar-value {dtmClass(mut.dtm)}">{mut.dtm > 0 ? '+' : ''}{mut.dtm.toFixed(2)} K</span>
													</div>
												{/each}
											</div>
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
					{#if filteredSummary.length === 0}
						<tr><td colspan="8" class="empty-cell">No positions match the current filters</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Mutations tab -->
	{#if tab === 'mutations'}
		<div class="heatmap-section">
			<div class="heatmap-card">
				<div class="heatmap-card-header">
					<span class="heatmap-title">Mutation effect map</span>
					<span class="heatmap-sub">ΔTm (K) per position and amino acid substitution — green = ΔTm &lt; 0, red = ΔTm &gt; 0</span>
				</div>
				<MutationHeatmap
					positions={hmPositions}
					headerRows={hmHeaderRows}
					dataRows={hmDataRows}
					colorbar={hmColorbar}
					gapIndices={hmGapIndices}
				/>
			</div>
		</div>
	{/if}

	<!-- Log tab -->
	{#if tab === 'log' && logContent}
		<JobLogs content={logContent} />
	{/if}
</div>

<!-- Chart modal -->
{#if modalChart}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label={MODAL_TITLES[modalChart]} tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && (modalChart = null)}
		onkeydown={(e) => e.key === 'Escape' && (modalChart = null)}
	>
		<div class="modal-box">
			<div class="modal-header">
				<span class="modal-title">{MODAL_TITLES[modalChart]}</span>
				{#if modalChart === 'profile' && modalZoomSize !== null}
					<span class="zoom-hint">{modalZoomSize} / {filteredSummary.length} positions — double-click to reset</span>
				{:else if modalChart === 'profile'}
					<span class="zoom-hint">Scroll to zoom · drag to pan</span>
				{/if}
				<button class="modal-close" onclick={() => (modalChart = null)} aria-label="Close">✕</button>
			</div>
			<div class="modal-chart-wrap"
				onwheel={onModalWheel}
				onpointerdown={onModalPointerDown}
				onpointermove={onModalPointerMove}
				onpointerup={onModalPointerUp}
				ondblclick={onModalDblClick}
				style="cursor: {modalChart === 'profile' ? (isDragging ? 'grabbing' : modalZoomSize !== null ? 'grab' : 'default') : 'default'}"
			><canvas bind:this={canvasModal}></canvas></div>
		</div>
	</div>
{/if}

<style>
	.page { max-width: 1100px; margin: 0 auto; padding: 2.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
	.tabs-spacer { flex: 1; }
	.viewer-card { min-width: 0; }
	.viewer-clear { background: none; border: 1px solid var(--border); border-radius: 0.3rem; padding: 0.1rem 0.4rem; font-size: 0.7rem; color: var(--text-muted); cursor: pointer; white-space: nowrap; }
	.viewer-clear:hover { border-color: var(--text-muted); color: var(--text); }
	.cb-col { width: 36px; text-align: center; padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
	.cb-col input[type='checkbox'] { cursor: pointer; accent-color: var(--accent); width: 14px; height: 14px; }
	.summary-row.is-sel { background: color-mix(in srgb, var(--accent) 5%, transparent); }
	.header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
	.header-left { display: flex; align-items: center; gap: 0.875rem; }
	.tool-badge { font-size: 0.8rem; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 0.375rem; padding: 0.25rem 0.6rem; white-space: nowrap; }
	.page-title { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0; line-height: 1.3; }
	.page-sub { font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 0.15rem; font-family: monospace; }
	.action-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.45rem 0.875rem; font-size: 0.85rem; color: var(--text); cursor: pointer; text-decoration: none; transition: border-color 0.15s; white-space: nowrap; align-self: center; }
	.action-btn:hover { border-color: var(--text-muted); }
	.header-actions { display: flex; align-items: center; gap: 0.5rem; }
	.dl-wrap { position: relative; }
	.dl-btn { display: flex; align-items: center; gap: 0.3rem; }
	.dl-menu { position: absolute; top: calc(100% + 0.4rem); right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 0.6rem; padding: 0.35rem; display: flex; flex-direction: column; gap: 0.15rem; min-width: 180px; z-index: 50; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
	.dl-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 0.4rem; font-size: 0.82rem; color: var(--text); text-decoration: none; transition: background 0.1s; }
	.dl-item:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--accent); }
	.dl-ext { font-family: monospace; font-size: 0.72rem; font-weight: 700; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border-radius: 0.25rem; padding: 0.1rem 0.3rem; min-width: 34px; text-align: center; }
	.tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0; }
	.tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; gap: 0.5rem; margin-bottom: -1px; }
	.tab:hover { color: var(--text); }
	.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
	.tab-count { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); background: var(--border); border-radius: 999px; padding: 0.1rem 0.45rem; }
	.tab.active .tab-count { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
	.filters { display: flex; flex-wrap: wrap; gap: 1rem 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1rem 1.25rem; align-items: flex-start; }
	.filter-group { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.filter-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; min-width: 60px; }
	.pills { display: flex; flex-wrap: wrap; gap: 0.3rem; }
	.pill { background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 0.2rem 0.65rem; font-size: 0.78rem; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s; }
	.pill.active { background: color-mix(in srgb, var(--accent) 12%, transparent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent); }
	.range-row { display: flex; align-items: center; gap: 0.4rem; }
	.range-input { width: 72px; background: var(--bg); border: 1px solid var(--border); border-radius: 0.4rem; padding: 0.25rem 0.5rem; font-size: 0.82rem; color: var(--text); text-align: center; }
	.range-sep, .range-unit { font-size: 0.78rem; color: var(--text-muted); }
	.search-input { background: var(--bg); border: 1px solid var(--border); border-radius: 0.4rem; padding: 0.25rem 0.6rem; font-size: 0.82rem; color: var(--text); width: 120px; transition: border-color 0.15s; }
	.search-input:focus { outline: none; border-color: var(--accent); }
	.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 0.875rem; background: var(--surface); }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
	.data-table th { text-align: left; padding: 0.65rem 0.875rem; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; background: var(--surface); }
	.data-table td { padding: 0.5rem 0.875rem; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
	.data-table tbody tr:last-child td, .data-table tbody tr:last-child.detail-row td { border-bottom: none; }
	.data-table th.num, .data-table td.num { text-align: right; }
	.summary-row { cursor: pointer; transition: background 0.1s; }
	.summary-row:hover { background: color-mix(in srgb, var(--accent) 4%, transparent); }
	.summary-row.is-open { background: color-mix(in srgb, var(--accent) 6%, transparent); }
	.pos-cell { font-family: monospace; font-size: 0.875rem; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; }
	.expand-icon { color: var(--text-muted); font-size: 0.7rem; width: 12px; flex-shrink: 0; }
	.res-cell { font-family: monospace; font-weight: 600; }
	.ss-badge { display: inline-block; font-size: 0.72rem; font-weight: 600; border-radius: 0.25rem; padding: 0.1rem 0.4rem; white-space: nowrap; }
	.ss-H { background: #fee2e2; color: #b91c1c; } .ss-G { background: #fecaca; color: #dc2626; } .ss-I { background: #fca5a5; color: #7f1d1d; }
	.ss-E { background: #e0e7ff; color: #3730a3; } .ss-B { background: #cffafe; color: #155e75; }
	.ss-T { background: #ffe4e6; color: #9f1239; } .ss-S { background: #bbf7d0; color: #14532d; }
	.ss-C { background: #dcfce7; color: #166534; }
	:root[data-theme='dark'] .ss-H { background: #7f1d1d; color: #fca5a5; } :root[data-theme='dark'] .ss-G { background: #991b1b; color: #fecaca; }
	:root[data-theme='dark'] .ss-I { background: #450a0a; color: #fca5a5; } :root[data-theme='dark'] .ss-E { background: #312e81; color: #c7d2fe; }
	:root[data-theme='dark'] .ss-B { background: #083344; color: #67e8f9; } :root[data-theme='dark'] .ss-T { background: #4c0519; color: #fda4af; }
	:root[data-theme='dark'] .ss-S { background: #14532d; color: #86efac; } :root[data-theme='dark'] .ss-C { background: #166534; color: #bbf7d0; }
	.dtm-pill { display: inline-block; font-family: monospace; font-size: 0.82rem; font-weight: 600; border-radius: 0.25rem; padding: 0.1rem 0.4rem; white-space: nowrap; }
	.dtm-ss { background: #fecaca; color: #7f1d1d; } .dtm-sl { background: #ffedd5; color: #9a3412; }
	.dtm-dl { background: #dcfce7; color: #166534; } .dtm-ds { background: #bbf7d0; color: #14532d; }
	:root[data-theme='dark'] .dtm-ss { background: #7f1d1d; color: #fca5a5; } :root[data-theme='dark'] .dtm-sl { background: #7c2d12; color: #fed7aa; }
	:root[data-theme='dark'] .dtm-dl { background: #166534; color: #bbf7d0; } :root[data-theme='dark'] .dtm-ds { background: #14532d; color: #86efac; }
	.green-val { color: #16a34a; font-family: monospace; } .red-val { color: #dc2626; font-family: monospace; }
	.sortable { cursor: pointer; user-select: none; } .sortable:hover { color: var(--text); }
	.sort-active { color: var(--accent) !important; } .sort-arrow { opacity: 0.35; font-size: 0.7rem; } .sort-active .sort-arrow { opacity: 1; color: var(--accent); }
	.detail-row td { padding: 0; background: color-mix(in srgb, var(--accent) 3%, var(--bg)); }
	.detail-panel { padding: 1rem 1.25rem; border-top: 1px solid color-mix(in srgb, var(--accent) 20%, transparent); }
	.detail-header { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem; }
	.bar-chart { display: flex; flex-direction: column; gap: 0.25rem; }
	.bar-row { display: grid; grid-template-columns: 56px 44px 1fr 80px; align-items: center; gap: 0.5rem; }
	.bar-label { font-family: monospace; font-size: 0.72rem; color: var(--text-muted); text-align: right; }
	.bar-mutname { font-family: monospace; font-size: 0.75rem; font-weight: 600; color: var(--text); }
	.bar-track { position: relative; height: 10px; background: var(--border); border-radius: 5px; overflow: hidden; }
	.bar-center-line { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--text-muted); opacity: 0.4; transform: translateX(-50%); }
	.bar-fill { position: absolute; top: 0; bottom: 0; border-radius: 3px; } .bar-neg { background: #22c55e; } .bar-pos { background: #ef4444; }
	.bar-value { font-family: monospace; font-size: 0.75rem; font-weight: 600; text-align: right; }
	.charts-section { display: flex; flex-direction: column; gap: 0.75rem; }
	.charts-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; }
	.chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
	.chart-clickable { cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
	.chart-clickable:hover { border-color: color-mix(in srgb, var(--accent) 40%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent); }
	.chart-clickable:hover .chart-expand-hint { opacity: 1; }
	.chart-card-header { display: flex; align-items: center; justify-content: space-between; }
	.chart-expand-hint { font-size: 0.7rem; color: var(--accent); opacity: 0; transition: opacity 0.15s; white-space: nowrap; }
	.chart-title { font-size: 0.82rem; font-weight: 600; color: var(--text); }
	.chart-sub { font-size: 0.72rem; color: var(--text-muted); line-height: 1.4; }
	.chart-wrap { position: relative; height: 180px; margin-top: 0.5rem; }
	.modal-backdrop { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 2rem; animation: fade-in 0.15s ease; }
	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	.modal-box { background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; width: min(900px, 100%); max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 24px 80px rgba(0,0,0,0.25); animation: slide-up 0.18s ease; }
	@keyframes slide-up { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }
	.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid var(--border); flex-shrink: 0; }
	.modal-title { font-size: 0.9rem; font-weight: 600; color: var(--text); }
	.modal-close { background: none; border: none; font-size: 1rem; color: var(--text-muted); cursor: pointer; padding: 0.25rem 0.5rem; border-radius: 0.35rem; line-height: 1; }
	.modal-close:hover { background: var(--border); color: var(--text); }
	.zoom-hint { font-size: 0.72rem; color: var(--text-muted); margin-left: auto; margin-right: 0.75rem; white-space: nowrap; }
	.modal-chart-wrap { flex: 1; padding: 1.25rem; min-height: 0; height: 520px; }
	.modal-chart-wrap canvas { width: 100% !important; height: 100% !important; }
	.empty-cell { text-align: center; color: var(--text-muted); font-size: 0.875rem; padding: 2.5rem !important; }
	@media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr 1fr; } .charts-grid .chart-card:first-child { grid-column: 1 / -1; } }
	@media (max-width: 600px) { .charts-grid { grid-template-columns: 1fr; } .charts-grid .chart-card:first-child { grid-column: auto; } }
	@media (max-width: 768px) { .page { padding: 1.5rem 1rem; } .bar-row { grid-template-columns: 48px 40px 1fr 72px; gap: 0.35rem; } .filter-label { min-width: 50px; } }
	@media (max-width: 480px) { .header { flex-direction: column; } .tabs { overflow-x: auto; } }
	.heatmap-section { display: flex; flex-direction: column; gap: 1rem; }
	.heatmap-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.heatmap-card-header { display: flex; flex-direction: column; gap: 0.2rem; }
	.heatmap-title { font-size: 0.82rem; font-weight: 600; color: var(--text); }
	.heatmap-sub { font-size: 0.72rem; color: var(--text-muted); line-height: 1.4; }
</style>
