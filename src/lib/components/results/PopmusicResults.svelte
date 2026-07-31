<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme';
	import PdbMetadata from '$lib/components/pdb/PdbMetadata.svelte';
	import ProteinViewer from '$lib/components/ProteinViewer.svelte';
	import MsaViewer from '$lib/components/MsaViewer.svelte';
	import MutationHeatmap, { ddgColor as hmDdgColor, rsaColor as hmRsaColor } from '$lib/components/MutationHeatmap.svelte';
	import type { HeatmapRowDef, ColorbarDef } from '$lib/components/MutationHeatmap.svelte';
	import type { SummaryRow, MutationRow } from '$lib/utils/popmusic';
	import type { Chart as ChartType } from 'chart.js';
	import type { PdbMetadata as PdbMeta } from '$lib/utils/pdb';

	let Chart = $state<typeof ChartType | null>(null);

	interface Props {
		structureId: string;
		summary: SummaryRow[];
		mutations: MutationRow[];
		meta: PdbMeta;
		pdbUrl: string;
		downloadUrls: { pops: string; pop: string; pdb: string };
		title?: string;
		subtitle?: string;
		backUrl?: string;
		msaContent?: string | null;
	}

	let { structureId, summary, mutations, meta, pdbUrl, downloadUrls, title, subtitle, backUrl, msaContent = null }: Props = $props();

	const displayTitle    = $derived(title    ?? structureId);
	const displaySubtitle = $derived(subtitle ?? '');

	const ACCENT = '#6366f1';

	const SS_LABELS: Record<string, string> = {
		H: 'Helix', G: '310-Helix', I: 'π-Helix',
		E: 'Sheet', B: 'Bridge', T: 'Turn', S: 'Bend', C: 'Coil'
	};

	const allChains = $derived([...new Set(summary.map((r) => r.chain))].sort());
	const allSS     = $derived([...new Set(summary.map((r) => r.secStruct))].sort());
	const rawMin    = $derived(Math.floor(Math.min(...summary.map((r) => r.avgDdg)) * 10) / 10);
	const rawMax    = $derived(Math.ceil(Math.max(...summary.map((r) => r.avgDdg)) * 10) / 10);

	const mutationsByPos = $derived.by(() => {
		const map = new Map<string, MutationRow[]>();
		for (const m of mutations) {
			const key = `${m.chain}-${m.resNum}`;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(m);
		}
		for (const arr of map.values()) arr.sort((a, b) => a.ddg - b.ddg);
		return map;
	});

	let tab = $state<'summary' | 'mutations' | 'msa'>('summary');
	let selectedResidues = $state(new Set<string>());

	// ── Heatmap data ─────────────────────────────────────────────────────────
	const AA_ORDER = ['A','C','D','E','F','G','H','I','K','L','M','N','P','Q','R','S','T','V','W','Y'];
	const AA1_TO_3: Record<string, string> = {
		A:'ALA',C:'CYS',D:'ASP',E:'GLU',F:'PHE',G:'GLY',H:'HIS',I:'ILE',K:'LYS',L:'LEU',
		M:'MET',N:'ASN',P:'PRO',Q:'GLN',R:'ARG',S:'SER',T:'THR',V:'VAL',W:'TRP',Y:'TYR'
	};

	// Sequence-ordered (by chain + resNum) version of the filtered summary for heatmap
	const hmSummary = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = summary.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				r.avgDdg >= ddgMin && r.avgDdg <= ddgMax &&
				(!q || r.resName.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => a.chain.localeCompare(b.chain) || a.resNum - b.resNum);
	});

	// Gap-filled slot list: every integer residue number between min and max per chain,
	// with null for positions absent from the popmusic output (HETATM, missing density, etc.)
	const hmSlots = $derived.by(() => {
		const byChain = new Map<string, SummaryRow[]>();
		for (const r of hmSummary) {
			if (!byChain.has(r.chain)) byChain.set(r.chain, []);
			byChain.get(r.chain)!.push(r);
		}
		const positions: string[] = [];
		const slots: (SummaryRow | null)[] = [];
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

	// Map posKey → (mutRes3 → ddg) for fast lookup
	const mutByPosAA = $derived.by(() => {
		const map = new Map<string, Map<string, number>>();
		for (const m of mutations) {
			const key = `${m.chain}-${m.resNum}`;
			if (!map.has(key)) map.set(key, new Map());
			map.get(key)!.set(m.mutRes, m.ddg);
		}
		return map;
	});

	const hmHeaderRows = $derived<HeatmapRowDef[]>([
		{
			label: 'RSA',
			values: hmSlots.slots.map((r) => r?.accessibility ?? null),
			colorFn: hmRsaColor,
			vmin: 0, vmax: 100,
			fmt: (v) => v.toFixed(0),
		},
		{
			label: 'Mean',
			values: hmSlots.slots.map((r) => r?.avgDdg ?? null),
			colorFn: hmDdgColor,
			fmt: (v) => v.toFixed(2),
		},
	]);

	const hmDataRows = $derived<HeatmapRowDef[]>(
		AA_ORDER.map((aa1) => {
			const aa3 = AA1_TO_3[aa1];
			return {
				label: aa1,
				values: hmSlots.slots.map((r) => {
					if (!r) return null; // gap position
					if (r.resName === aa3) return null; // wild-type
					const posKey = `${r.chain}-${r.resNum}`;
					return mutByPosAA.get(posKey)?.get(aa3) ?? null;
				}),
				colorFn: hmDdgColor,
				fmt: (v) => v.toFixed(2),
			};
		})
	);

	// Column indices that are structural gaps (no popmusic data)
	const hmGapIndices = $derived(
		new Set(
			hmSlots.slots
				.map((s, i) => (s === null ? i : -1))
				.filter((i) => i >= 0)
		)
	);

	// Shared ΔΔG colorbar for data rows
	const hmColorbar = $derived<ColorbarDef>({
		label: 'ΔΔG (kcal/mol)',
		vmin: Math.max(-5, Math.floor(Math.min(...mutations.map((m) => m.ddg)) * 10) / 10),
		vmax: Math.min(5,  Math.ceil( Math.max(...mutations.map((m) => m.ddg)) * 10) / 10),
		colorFn: hmDdgColor,
		fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(1),
	});
	function toggleResidue(key: string) {
		const next = new Set(selectedResidues);
		if (next.has(key)) next.delete(key); else next.add(key);
		selectedResidues = next;
	}

	function ddgHex(v: number): string {
		if (v < -0.5) return '#22c55e';
		if (v < 0)    return '#86efac';
		if (v < 0.5)  return '#fb923c';
		return '#ef4444';
	}

	let _chains  = $state<string[] | null>(null);
	let _structs = $state<string[] | null>(null);
	let _ddgMin  = $state<number | null>(null);
	let _ddgMax  = $state<number | null>(null);
	let search   = $state('');
	let expanded = $state<string | null>(null);
	let sortDir  = $state<1 | -1>(1);
	let showDownload = $state(false);

	let canvasProfile = $state<HTMLCanvasElement | undefined>();
	let canvasScatter = $state<HTMLCanvasElement | undefined>();
	let canvasDist    = $state<HTMLCanvasElement | undefined>();

	type ModalChart = 'profile' | 'scatter' | 'dist';
	let modalChart  = $state<ModalChart | null>(null);
	let canvasModal = $state<HTMLCanvasElement | undefined>();

	const MODAL_TITLES: Record<ModalChart, string> = {
		profile: 'Mutation sensitivity profile',
		scatter: 'Accessibility vs mutation effect',
		dist:    'ΔΔG distribution',
	};

	type SummaryCol = 'accessibility' | 'avgDdg' | 'sumNegDdg' | 'sumPosDdg';
	let summarySort = $state<{ col: SummaryCol; dir: 1 | -1 }>({ col: 'avgDdg', dir: 1 });
	function toggleSummarySort(col: SummaryCol) {
		summarySort = summarySort.col === col
			? { col, dir: (summarySort.dir * -1) as 1 | -1 }
			: { col, dir: 1 };
	}

	const chains  = $derived(_chains  ?? allChains);
	const structs = $derived(_structs ?? allSS);
	const ddgMin  = $derived(_ddgMin  ?? rawMin);
	const ddgMax  = $derived(_ddgMax  ?? rawMax);

	const filteredSummary = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = summary.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				r.avgDdg >= ddgMin && r.avgDdg <= ddgMax &&
				(!q || r.resName.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => (a[summarySort.col] - b[summarySort.col]) * summarySort.dir);
	});

	const viewerResidues = $derived(
		filteredSummary.map((r) => ({
			chain: r.chain,
			resNum: r.resNum,
			color: ddgHex(r.avgDdg),
			selected: selectedResidues.has(`${r.chain}-${r.resNum}`)
		}))
	);

	const filteredMutations = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = mutations.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				(!q || r.wtRes.toLowerCase().includes(q) || r.mutRes.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => (a.ddg - b.ddg) * sortDir);
	});

	function toggleChain(c: string) {
		const cur = chains;
		_chains = cur.includes(c) ? (cur.length > 1 ? cur.filter((x) => x !== c) : cur) : [...cur, c];
	}
	function toggleStruct(s: string) {
		const cur = structs;
		_structs = cur.includes(s) ? (cur.length > 1 ? cur.filter((x) => x !== s) : cur) : [...cur, s];
	}

	function ddgClass(v: number): string {
		if (v < -0.5) return 'ddg-ss';
		if (v < 0)    return 'ddg-sl';
		if (v < 0.5)  return 'ddg-dl';
		return 'ddg-ds';
	}

	const BAR_MAX = 3;
	function barPct(ddg: number): string { return `${Math.min((Math.abs(ddg) / BAR_MAX) * 50, 50)}%`; }
	function rowKey(r: SummaryRow): string { return `${r.chain}-${r.resNum}`; }

	$effect(() => { void chains, structs, ddgMin, ddgMax, search; expanded = null; });

	// ── Charts ──────────────────────────────────────────────────────────
	function ddgColor(v: number, alpha = 0.85): string {
		if (v < -0.5) return `rgba(34,197,94,${alpha})`;
		if (v < 0)    return `rgba(134,239,172,${alpha})`;
		if (v < 0.5)  return `rgba(251,146,60,${alpha})`;
		return `rgba(239,68,68,${alpha})`;
	}

	const SS_COLORS: Record<string, string> = {
		H: '#8b5cf6', G: '#7c3aed', I: '#6d28d9',
		E: '#f59e0b', B: '#d97706',
		T: '#06b6d4', S: '#0891b2',
		C: '#94a3b8'
	};

	function chartColors() {
		const isDark = $theme === 'dark';
		return {
			text: isDark ? '#94a3b8' : '#64748b',
			grid: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
			zero: isDark ? 'rgba(255,255,255,0.2)' : '#94a3b8',
		};
	}

	function makeProfileChart(canvas: HTMLCanvasElement, rows: SummaryRow[], C = Chart!) {
		const c = chartColors();
		return new C(canvas, {
			type: 'bar',
			data: {
				labels: rows.map((r) => `${r.chain}${r.resNum}`),
				datasets: [{ data: rows.map((r) => r.avgDdg), backgroundColor: rows.map((r) => ddgColor(r.avgDdg)), borderWidth: 0, barPercentage: 0.85 }]
			},
			options: {
				responsive: true, maintainAspectRatio: false, animation: false,
				plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${(ctx.raw as number) > 0 ? '+' : ''}${(ctx.raw as number).toFixed(2)} kcal/mol` } } },
				scales: {
					x: { ticks: { color: c.text, maxTicksLimit: 15, font: { size: 11 } }, grid: { display: false } },
					y: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid }, border: { color: c.zero }, title: { display: true, text: 'Avg ΔΔG (kcal/mol)', color: c.text, font: { size: 11 } } }
				}
			}
		});
	}

	function makeScatterChart(canvas: HTMLCanvasElement, rows: SummaryRow[], C = Chart!) {
		const c = chartColors();
		const bySS = new Map<string, { x: number; y: number; label: string }[]>();
		for (const r of rows) {
			if (!bySS.has(r.secStruct)) bySS.set(r.secStruct, []);
			bySS.get(r.secStruct)!.push({ x: r.accessibility, y: r.avgDdg, label: `${r.chain}${r.resNum} ${r.resName}` });
		}
		const datasets = [...bySS.entries()].map(([ss, pts]) => ({
			label: SS_LABELS[ss] ?? ss,
			data: pts,
			backgroundColor: `${SS_COLORS[ss] ?? '#94a3b8'}cc`,
			pointRadius: 3, pointHoverRadius: 5
		}));
		return new C(canvas, {
			type: 'scatter', data: { datasets },
			options: {
				responsive: true, maintainAspectRatio: false, animation: false,
				plugins: { legend: { position: 'bottom', labels: { color: c.text, boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { label: (ctx) => { const pt = ctx.raw as { x: number; y: number; label: string }; return `${pt.label}: acc=${pt.x.toFixed(1)}% ΔΔG=${pt.y > 0 ? '+' : ''}${pt.y.toFixed(2)}`; } } } },
				scales: {
					x: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid }, title: { display: true, text: 'Solvent accessibility (%)', color: c.text, font: { size: 11 } } },
					y: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid }, border: { color: c.zero }, title: { display: true, text: 'Avg ΔΔG (kcal/mol)', color: c.text, font: { size: 11 } } }
				}
			}
		});
	}

	function makeDistChart(canvas: HTMLCanvasElement, muts: MutationRow[], C = Chart!) {
		const c = chartColors();
		const BIN = 0.2, LO = -3, HI = 3;
		const bins: number[] = Array(Math.round((HI - LO) / BIN)).fill(0);
		for (const m of muts) {
			const i = Math.floor((Math.min(Math.max(m.ddg, LO), HI - 0.001) - LO) / BIN);
			bins[i]++;
		}
		const labels = bins.map((_, i) => (LO + i * BIN).toFixed(1));
		return new C(canvas, {
			type: 'bar',
			data: { labels, datasets: [{ data: bins, backgroundColor: labels.map((l) => parseFloat(l) < 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'), borderWidth: 0, barPercentage: 1.0, categoryPercentage: 1.0 }] },
			options: {
				responsive: true, maintainAspectRatio: false, animation: false,
				plugins: { legend: { display: false }, tooltip: { callbacks: { title: (ctx) => `ΔΔG ≈ ${ctx[0].label} kcal/mol`, label: (ctx) => ` ${ctx.raw} mutations` } } },
				scales: {
					x: { ticks: { color: c.text, maxTicksLimit: 12, font: { size: 11 } }, grid: { display: false }, title: { display: true, text: 'ΔΔG (kcal/mol)', color: c.text, font: { size: 11 } } },
					y: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid }, title: { display: true, text: 'Mutations', color: c.text, font: { size: 11 } } }
				}
			}
		});
	}

	$effect(() => { if (!Chart || !canvasProfile) return; const rows = filteredSummary; void $theme; const chart = makeProfileChart(canvasProfile, rows); return () => chart.destroy(); });
	$effect(() => { if (!Chart || !canvasScatter) return; const rows = filteredSummary; void $theme; const chart = makeScatterChart(canvasScatter, rows); return () => chart.destroy(); });
	$effect(() => { if (!Chart || !canvasDist) return; const muts = filteredMutations; void $theme; const chart = makeDistChart(canvasDist, muts); return () => chart.destroy(); });
	$effect(() => {
		if (!Chart || !canvasModal || !modalChart) return;
		void $theme;
		const chart = modalChart === 'profile' ? makeProfileChart(canvasModal, filteredSummary)
			: modalChart === 'scatter' ? makeScatterChart(canvasModal, filteredSummary)
			: makeDistChart(canvasModal, filteredMutations);
		return () => chart.destroy();
	});

	// ── Floating 3D viewer ───────────────────────────────────────────────
	let showViewer = $state(false);
	let everOpened = $state(false);
	let floatX = $state(0);
	let floatY = $state(0);
	$effect(() => { if (showViewer) everOpened = true; });

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

	onMount(() => {
		floatX = Math.max(16, window.innerWidth - 452);
		floatY = Math.max(16, window.innerHeight - 420);
		import('chart.js').then(({ Chart: C, registerables }) => {
			C.register(...registerables);
			Chart = C as unknown as typeof ChartType;
		});
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { modalChart = null; showViewer = false; } };
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
				<h1 class="page-title">{displayTitle}</h1>
				{#if displaySubtitle}<span class="page-sub">{displaySubtitle}</span>{/if}
			</div>
		</div>
		<div class="header-actions">
			<div class="dl-wrap">
				<button class="action-btn dl-btn" onclick={() => (showDownload = !showDownload)}>↓ Download</button>
				{#if showDownload}
					<div class="dl-menu">
						<a href={downloadUrls.pops} class="dl-item">
							<span class="dl-ext">.pops</span> Position summary
						</a>
						<a href={downloadUrls.pop} class="dl-item">
							<span class="dl-ext">.pop</span> All mutations
						</a>
						<a href={downloadUrls.pdb} class="dl-item">
							<span class="dl-ext">.pdb</span> Structure file
						</a>
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
		{#if msaContent}
			<button class="tab" class:active={tab === 'msa'} onclick={() => (tab = 'msa')}>
				MSA
			</button>
		{/if}
		<div class="tabs-spacer"></div>
		<button class="tab-3d" class:tab-3d-active={showViewer} onclick={() => (showViewer = !showViewer)}>
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
				<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
			</svg>
			3D
			{#if selectedResidues.size > 0}<span class="tab-3d-badge">{selectedResidues.size}</span>{/if}
		</button>
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
				<span class="filter-label">Avg ΔΔG</span>
				<div class="range-row">
					<input type="number" class="range-input" value={ddgMin} step="0.1" min={rawMin} max={ddgMax} oninput={(e) => (_ddgMin = parseFloat(e.currentTarget.value))} />
					<span class="range-sep">to</span>
					<input type="number" class="range-input" value={ddgMax} step="0.1" min={ddgMin} max={rawMax} oninput={(e) => (_ddgMax = parseFloat(e.currentTarget.value))} />
					<span class="range-unit">kcal/mol</span>
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
				{#each ([['profile', 'Mutation sensitivity profile', 'Average ΔΔG per position along the sequence — peaks highlight mutation hotspots'], ['scatter', 'Accessibility vs mutation effect', 'Core residues (low accessibility) tend to be more sensitive to mutations'], ['dist', 'ΔΔG distribution', 'Distribution of all individual mutation effects — most mutations are destabilizing']] as const) as [id, title, sub]}
					<div class="chart-card chart-clickable" role="button" tabindex="0"
						onclick={() => (modalChart = id)}
						onkeydown={(e) => e.key === 'Enter' && (modalChart = id)}
					>
						<div class="chart-card-header">
							<div class="chart-title">{title}</div>
							<span class="chart-expand-hint">⤢ expand</span>
						</div>
						<div class="chart-sub">{sub}</div>
						<div class="chart-wrap">
							{#if id === 'profile'}<canvas bind:this={canvasProfile}></canvas>
							{:else if id === 'scatter'}<canvas bind:this={canvasScatter}></canvas>
							{:else}<canvas bind:this={canvasDist}></canvas>{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th class="cb-col">3D</th>
						<th>Position</th>
						<th>Residue</th>
						<th>Sec. Structure</th>
						{#each ([['accessibility', 'RSA'], ['avgDdg', 'Avg ΔΔG'], ['sumNegDdg', 'Σ Stabilizing'], ['sumPosDdg', 'Σ Destabilizing']] as const) as [col, label]}
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
							<td class="num"><span class="ddg-pill {ddgClass(row.avgDdg)}">{row.avgDdg > 0 ? '+' : ''}{row.avgDdg.toFixed(2)}</span></td>
							<td class="num green-val">{row.sumNegDdg.toFixed(2)}</td>
							<td class="num orange-val">{row.sumPosDdg.toFixed(2)}</td>
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
														<span class="bar-label">{row.resName.slice(0, 1)}{row.resNum}{mut.mutRes.slice(0, 1)}</span>
														<span class="bar-mutname">{mut.mutRes}</span>
														<div class="bar-track">
															<div class="bar-center-line"></div>
															<div class="bar-fill {mut.ddg < 0 ? 'bar-neg' : 'bar-pos'}" style="{mut.ddg < 0 ? 'right:50%' : 'left:50%'}; width:{barPct(mut.ddg)}"></div>
														</div>
														<span class="bar-value {ddgClass(mut.ddg)}">{mut.ddg > 0 ? '+' : ''}{mut.ddg.toFixed(2)}</span>
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
					<span class="heatmap-sub">ΔΔG (kcal/mol) per position and amino acid substitution — red = destabilizing, blue = stabilizing</span>
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

	<!-- MSA tab -->
	{#if tab === 'msa' && msaContent}
		<div class="msa-section">
			<MsaViewer msaContent={msaContent} />
		</div>
	{/if}
</div>

<!-- Floating 3D viewer -->
{#if everOpened}
	<div class="float-panel" class:float-hidden={!showViewer} style="left: {floatX}px; top: {floatY}px" role="dialog" aria-label="3D Structure viewer">
		<div class="float-header" onpointerdown={startDrag} role="toolbar" aria-label="Drag to move" tabindex="0">
			<span class="float-title">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
					<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
				</svg>
				{meta.id}
			</span>
			{#if selectedResidues.size > 0}
				<span class="float-sel">{selectedResidues.size} highlighted</span>
				<button class="float-clear" onclick={() => (selectedResidues = new Set())}>Clear</button>
			{/if}
			<button class="float-close" onclick={() => (showViewer = false)} aria-label="Close">✕</button>
		</div>
		<div class="float-body">
			<ProteinViewer {pdbUrl} residues={viewerResidues} height="340px" />
		</div>
	</div>
{/if}

<!-- Chart modal -->
{#if modalChart}
	<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label={MODAL_TITLES[modalChart]} tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && (modalChart = null)}
		onkeydown={(e) => e.key === 'Escape' && (modalChart = null)}
	>
		<div class="modal-box">
			<div class="modal-header">
				<span class="modal-title">{MODAL_TITLES[modalChart]}</span>
				<button class="modal-close" onclick={() => (modalChart = null)} aria-label="Close">✕</button>
			</div>
			<div class="modal-chart-wrap"><canvas bind:this={canvasModal}></canvas></div>
		</div>
	</div>
{/if}

<style>
	.page { max-width: var(--page-max); margin: 0 auto; padding: 2.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
	.tabs-spacer { flex: 1; }
	.tab-3d { display: flex; align-items: center; gap: 0.35rem; background: none; border: 1px solid var(--border); border-radius: 0.45rem; padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.15s; margin: auto 0; }
	.tab-3d:hover { border-color: var(--accent); color: var(--accent); }
	.tab-3d-active { background: color-mix(in srgb, var(--accent) 10%, transparent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent); }
	.tab-3d-badge { background: var(--accent); color: #fff; font-size: 0.68rem; font-weight: 700; border-radius: 999px; padding: 0.05rem 0.4rem; min-width: 18px; text-align: center; }
	.float-panel { position: fixed; z-index: 150; width: 420px; background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; box-shadow: 0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08); display: flex; flex-direction: column; overflow: hidden; }
	.float-hidden { display: none; }
	.float-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem 0.6rem 1rem; border-bottom: 1px solid var(--border); cursor: grab; user-select: none; background: var(--surface); }
	.float-header:active { cursor: grabbing; }
	.float-title { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 700; color: var(--text); font-family: monospace; }
	.float-sel { font-size: 0.72rem; font-weight: 600; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); border-radius: 999px; padding: 0.1rem 0.45rem; white-space: nowrap; }
	.float-clear { background: none; border: 1px solid var(--border); border-radius: 0.3rem; padding: 0.1rem 0.4rem; font-size: 0.7rem; color: var(--text-muted); cursor: pointer; white-space: nowrap; }
	.float-clear:hover { border-color: var(--text-muted); color: var(--text); }
	.float-close { margin-left: auto; background: none; border: none; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 0.3rem; line-height: 1; }
	.float-close:hover { background: var(--border); color: var(--text); }
	.float-body { flex: 1; }
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
	.mono { font-family: monospace; }
	.expand-icon { color: var(--text-muted); font-size: 0.7rem; width: 12px; flex-shrink: 0; }
	.res-cell { font-family: monospace; font-weight: 600; }
	.mut-cell { font-family: monospace; }
	.ss-badge { display: inline-block; font-size: 0.72rem; font-weight: 600; border-radius: 0.25rem; padding: 0.1rem 0.4rem; white-space: nowrap; }
	.ss-H { background: #ede9fe; color: #6d28d9; } .ss-G { background: #ddd6fe; color: #7c3aed; } .ss-I { background: #e0e7ff; color: #4338ca; }
	.ss-E { background: #fef3c7; color: #92400e; } .ss-B { background: #fde68a; color: #78350f; }
	.ss-T { background: #ccfbf1; color: #0f766e; } .ss-S { background: #cffafe; color: #0e7490; }
	.ss-C { background: color-mix(in srgb, var(--border) 80%, transparent); color: var(--text-muted); }
	:root[data-theme='dark'] .ss-H { background: #2e1065; color: #c4b5fd; } :root[data-theme='dark'] .ss-G { background: #3b0764; color: #d8b4fe; }
	:root[data-theme='dark'] .ss-I { background: #1e1b4b; color: #a5b4fc; } :root[data-theme='dark'] .ss-E { background: #451a03; color: #fcd34d; }
	:root[data-theme='dark'] .ss-B { background: #422006; color: #fbbf24; } :root[data-theme='dark'] .ss-T { background: #042f2e; color: #5eead4; }
	:root[data-theme='dark'] .ss-S { background: #083344; color: #67e8f9; }
	.ddg-pill { display: inline-block; font-family: monospace; font-size: 0.82rem; font-weight: 600; border-radius: 0.25rem; padding: 0.1rem 0.4rem; white-space: nowrap; }
	.ddg-ss { background: #bbf7d0; color: #14532d; } .ddg-sl { background: #dcfce7; color: #166534; }
	.ddg-dl { background: #ffedd5; color: #9a3412; } .ddg-ds { background: #fecaca; color: #7f1d1d; }
	:root[data-theme='dark'] .ddg-ss { background: #14532d; color: #86efac; } :root[data-theme='dark'] .ddg-sl { background: #166534; color: #bbf7d0; }
	:root[data-theme='dark'] .ddg-dl { background: #7c2d12; color: #fed7aa; } :root[data-theme='dark'] .ddg-ds { background: #7f1d1d; color: #fca5a5; }
	.green-val { color: #16a34a; font-family: monospace; } .orange-val { color: #ea580c; font-family: monospace; }
	.sortable { cursor: pointer; user-select: none; } .sortable:hover { color: var(--text); }
	.sort-active { color: var(--accent) !important; } .sort-arrow { opacity: 0.35; font-size: 0.7rem; } .sort-active .sort-arrow { opacity: 1; color: var(--accent); }
	.detail-row td { padding: 0; background: color-mix(in srgb, var(--accent) 3%, var(--bg)); }
	.detail-panel { padding: 1rem 1.25rem; border-top: 1px solid color-mix(in srgb, var(--accent) 20%, transparent); }
	.detail-header { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem; }
	.bar-chart { display: flex; flex-direction: column; gap: 0.25rem; }
	.bar-row { display: grid; grid-template-columns: 56px 44px 1fr 64px; align-items: center; gap: 0.5rem; }
	.bar-label { font-family: monospace; font-size: 0.72rem; color: var(--text-muted); text-align: right; }
	.bar-mutname { font-family: monospace; font-size: 0.75rem; font-weight: 600; color: var(--text); }
	.bar-track { position: relative; height: 10px; background: var(--border); border-radius: 5px; overflow: hidden; }
	.bar-center-line { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--text-muted); opacity: 0.4; transform: translateX(-50%); }
	.bar-fill { position: absolute; top: 0; bottom: 0; border-radius: 3px; } .bar-neg { background: #22c55e; } .bar-pos { background: #ef4444; }
	.bar-value { font-family: monospace; font-size: 0.75rem; font-weight: 600; text-align: right; }
	.bar-chart-wrap { position: relative; }
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
	.modal-chart-wrap { flex: 1; padding: 1.25rem; min-height: 0; height: 520px; }
	.modal-chart-wrap canvas { width: 100% !important; height: 100% !important; }
	.empty-cell { text-align: center; color: var(--text-muted); font-size: 0.875rem; padding: 2.5rem !important; }
	@media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr 1fr; } .charts-grid .chart-card:first-child { grid-column: 1 / -1; } }
	@media (max-width: 600px) { .charts-grid { grid-template-columns: 1fr; } .charts-grid .chart-card:first-child { grid-column: auto; } }
	@media (max-width: 768px) { .page { padding: 1.5rem 1rem; } .bar-row { grid-template-columns: 48px 40px 1fr 56px; gap: 0.35rem; } .filter-label { min-width: 50px; } }
	@media (max-width: 480px) { .header { flex-direction: column; } .tabs { overflow-x: auto; } }

	/* Heatmap section */
	.heatmap-section { display: flex; flex-direction: column; gap: 1rem; }
	.heatmap-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.heatmap-card-header { display: flex; flex-direction: column; gap: 0.2rem; }
	.heatmap-title { font-size: 0.82rem; font-weight: 600; color: var(--text); }
	.heatmap-sub { font-size: 0.72rem; color: var(--text-muted); line-height: 1.4; }

	/* MSA section */
	.msa-section { background: var(--surface); border: 1px solid var(--border); border-radius: 0.875rem; padding: 1.25rem; overflow-x: auto; }
</style>
