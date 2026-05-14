<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import PdbMetadata from '$lib/components/pdb/PdbMetadata.svelte';
	import type { SummaryRow, MutationRow } from './+page.js';

	let { data } = $props();

	const ACCENT = '#6366f1';

	const SS_LABELS: Record<string, string> = {
		H: 'Helix',
		G: '310-Helix',
		I: 'π-Helix',
		E: 'Sheet',
		B: 'Bridge',
		T: 'Turn',
		S: 'Bend',
		C: 'Coil'
	};

	// All data accesses inside $derived to satisfy Svelte 5 reactivity rules
	const meta = $derived(data.meta);
	const allChains = $derived([...new Set(data.summary.map((r) => r.chain))].sort());
	const allSS = $derived([...new Set(data.summary.map((r) => r.secStruct))].sort());
	const rawMin = $derived(Math.floor(Math.min(...data.summary.map((r) => r.avgDdg)) * 10) / 10);
	const rawMax = $derived(Math.ceil(Math.max(...data.summary.map((r) => r.avgDdg)) * 10) / 10);

	const mutationsByPos = $derived.by(() => {
		const map = new Map<string, MutationRow[]>();
		for (const m of data.mutations) {
			const key = `${m.chain}-${m.resNum}`;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(m);
		}
		for (const arr of map.values()) arr.sort((a, b) => a.ddg - b.ddg);
		return map;
	});

	// Filter state — null means "use default from data" (avoids init-before-derived problems)
	let tab = $state<'summary' | 'mutations'>('summary');
	let _chains = $state<string[] | null>(null);
	let _structs = $state<string[] | null>(null);
	let _ddgMin = $state<number | null>(null);
	let _ddgMax = $state<number | null>(null);
	let search = $state('');
	let expanded = $state<string | null>(null);
	let sortDir = $state<1 | -1>(1);

	type SummaryCol = 'accessibility' | 'avgDdg' | 'sumNegDdg' | 'sumPosDdg';
	let summarySort = $state<{ col: SummaryCol; dir: 1 | -1 }>({ col: 'avgDdg', dir: 1 });

	function toggleSummarySort(col: SummaryCol) {
		summarySort =
			summarySort.col === col
				? { col, dir: (summarySort.dir * -1) as 1 | -1 }
				: { col, dir: 1 };
	}

	// Effective filter values fall back to full range when unset
	const chains = $derived(_chains ?? allChains);
	const structs = $derived(_structs ?? allSS);
	const ddgMin = $derived(_ddgMin ?? rawMin);
	const ddgMax = $derived(_ddgMax ?? rawMax);

	const filteredSummary = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = data.summary.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				r.avgDdg >= ddgMin &&
				r.avgDdg <= ddgMax &&
				(!q || r.resName.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => (a[summarySort.col] - b[summarySort.col]) * summarySort.dir);
	});

	const filteredMutations = $derived.by(() => {
		const q = search.toLowerCase();
		const rows = data.mutations.filter(
			(r) =>
				chains.includes(r.chain) &&
				structs.includes(r.secStruct) &&
				(!q || r.wtRes.toLowerCase().includes(q) || r.mutRes.toLowerCase().includes(q))
		);
		return [...rows].sort((a, b) => (a.ddg - b.ddg) * sortDir);
	});

	function toggleChain(c: string) {
		const cur = chains;
		_chains = cur.includes(c)
			? cur.length > 1
				? cur.filter((x) => x !== c)
				: cur
			: [...cur, c];
	}

	function toggleStruct(s: string) {
		const cur = structs;
		_structs = cur.includes(s)
			? cur.length > 1
				? cur.filter((x) => x !== s)
				: cur
			: [...cur, s];
	}

	function ddgClass(v: number): string {
		if (v < -0.5) return 'ddg-ss';
		if (v < 0) return 'ddg-sl';
		if (v < 0.5) return 'ddg-dl';
		return 'ddg-ds';
	}

	const BAR_MAX = 3;

	function barPct(ddg: number): string {
		return `${Math.min((Math.abs(ddg) / BAR_MAX) * 50, 50)}%`;
	}

	function rowKey(r: SummaryRow): string {
		return `${r.chain}-${r.resNum}`;
	}

	onMount(() => {
		document.body.setAttribute('data-tool', 'popmusic');
		return () => document.body.removeAttribute('data-tool');
	});
</script>

<div class="page" style="--accent: {ACCENT}">
	<!-- Header -->
	<div class="header">
		<div class="header-left">
			<span class="tool-badge">PopMuSiC</span>
			<div>
				<h1 class="page-title">p53 — Example results</h1>
				<span class="page-sub">Example · PopMuSiC v3.1 · PDB 8E7B</span>
			</div>
		</div>
		<a href="{base}/run?tool=popmusic" class="action-btn">Run your own analysis</a>
	</div>

	<!-- Protein metadata card -->
	<PdbMetadata {meta} selectedChains={meta.chains} accent={ACCENT} />

	<!-- Tabs -->
	<div class="tabs">
		<button class="tab" class:active={tab === 'summary'} onclick={() => (tab = 'summary')}>
			Summary
			<span class="tab-count">{filteredSummary.length} positions</span>
		</button>
		<button class="tab" class:active={tab === 'mutations'} onclick={() => (tab = 'mutations')}>
			All mutations
			<span class="tab-count">{filteredMutations.length}</span>
		</button>
	</div>

	<!-- Filters -->
	<div class="filters">
		{#if allChains.length > 1}
			<div class="filter-group">
				<span class="filter-label">Chain</span>
				<div class="pills">
					{#each allChains as c}
						<button class="pill" class:active={chains.includes(c)} onclick={() => toggleChain(c)}>
							{c}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="filter-group">
			<span class="filter-label">Structure</span>
			<div class="pills">
				{#each allSS as s}
					<button class="pill" class:active={structs.includes(s)} onclick={() => toggleStruct(s)}>
						{SS_LABELS[s] ?? s}
					</button>
				{/each}
			</div>
		</div>

		{#if tab === 'summary'}
			<div class="filter-group">
				<span class="filter-label">Avg ΔΔG</span>
				<div class="range-row">
					<input
						type="number"
						class="range-input"
						value={ddgMin}
						step="0.1"
						min={rawMin}
						max={ddgMax}
						oninput={(e) => (_ddgMin = parseFloat(e.currentTarget.value))}
					/>
					<span class="range-sep">to</span>
					<input
						type="number"
						class="range-input"
						value={ddgMax}
						step="0.1"
						min={ddgMin}
						max={rawMax}
						oninput={(e) => (_ddgMax = parseFloat(e.currentTarget.value))}
					/>
					<span class="range-unit">kcal/mol</span>
				</div>
			</div>
		{/if}

		<div class="filter-group">
			<span class="filter-label">Residue</span>
			<input
				type="search"
				class="search-input"
				bind:value={search}
				placeholder={tab === 'summary' ? 'e.g. ARG' : 'WT or mutant'}
			/>
		</div>
	</div>

	<!-- Summary tab -->
	{#if tab === 'summary'}
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th>Position</th>
						<th>Residue</th>
						<th>2° structure</th>
						<th
							class="num sortable"
							class:sort-active={summarySort.col === 'accessibility'}
							onclick={() => toggleSummarySort('accessibility')}
						>
							Accessibility <span class="sort-arrow">{summarySort.col === 'accessibility' ? (summarySort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th
							class="num sortable"
							class:sort-active={summarySort.col === 'avgDdg'}
							onclick={() => toggleSummarySort('avgDdg')}
						>
							Avg ΔΔG <span class="sort-arrow">{summarySort.col === 'avgDdg' ? (summarySort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th
							class="num sortable"
							class:sort-active={summarySort.col === 'sumNegDdg'}
							onclick={() => toggleSummarySort('sumNegDdg')}
						>
							Σ Stabilizing <span class="sort-arrow">{summarySort.col === 'sumNegDdg' ? (summarySort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
						<th
							class="num sortable"
							class:sort-active={summarySort.col === 'sumPosDdg'}
							onclick={() => toggleSummarySort('sumPosDdg')}
						>
							Σ Destabilizing <span class="sort-arrow">{summarySort.col === 'sumPosDdg' ? (summarySort.dir === 1 ? '↑' : '↓') : '↕'}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredSummary as row (rowKey(row))}
						{@const key = rowKey(row)}
						{@const isOpen = expanded === key}
						{@const posMuts = mutationsByPos.get(key) ?? []}
						<tr
							class="summary-row"
							class:is-open={isOpen}
							onclick={() => (expanded = isOpen ? null : key)}
							title="Click to expand mutations"
						>
							<td class="pos-cell">
								<span class="expand-icon">{isOpen ? '▾' : '▸'}</span>
								{row.chain}{row.resNum}
							</td>
							<td class="res-cell">{row.resName}</td>
							<td>
								<span class="ss-badge ss-{row.secStruct}">{SS_LABELS[row.secStruct] ?? row.secStruct}</span
								>
							</td>
							<td class="num">{row.accessibility.toFixed(1)}%</td>
							<td class="num">
								<span class="ddg-pill {ddgClass(row.avgDdg)}"
									>{row.avgDdg > 0 ? '+' : ''}{row.avgDdg.toFixed(2)}</span
								>
							</td>
							<td class="num green-val">{row.sumNegDdg.toFixed(2)}</td>
							<td class="num orange-val">{row.sumPosDdg.toFixed(2)}</td>
						</tr>
						{#if isOpen}
							<tr class="detail-row">
								<td colspan="7">
									<div class="detail-panel">
										<div class="detail-header">
											<strong>{row.resName} {row.chain}{row.resNum}</strong>
											— {posMuts.length} mutations · secondary structure: {SS_LABELS[row.secStruct] ??
												row.secStruct} · accessibility: {row.accessibility.toFixed(1)}%
										</div>
										<div class="bar-chart">
											{#each posMuts as mut}
												<div class="bar-row">
													<span class="bar-label"
														>{row.resName.slice(0, 1)}{row.resNum}{mut.mutRes.slice(0, 1)}</span
													>
													<span class="bar-mutname">{mut.mutRes}</span>
													<div class="bar-track">
														<div class="bar-center-line"></div>
														<div
															class="bar-fill {mut.ddg < 0 ? 'bar-neg' : 'bar-pos'}"
															style="{mut.ddg < 0 ? 'right:50%' : 'left:50%'}; width:{barPct(mut.ddg)}"
														></div>
													</div>
													<span class="bar-value {ddgClass(mut.ddg)}"
														>{mut.ddg > 0 ? '+' : ''}{mut.ddg.toFixed(2)}</span
													>
												</div>
											{/each}
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
					{#if filteredSummary.length === 0}
						<tr>
							<td colspan="7" class="empty-cell">No positions match the current filters</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Mutations tab -->
	{#if tab === 'mutations'}
		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th>Position</th>
						<th>Mutation</th>
						<th>2° structure</th>
						<th class="num">Accessibility</th>
						<th class="num sortable" onclick={() => (sortDir = sortDir === 1 ? -1 : 1)}>
							ΔΔG (kcal/mol)
							<span class="sort-arrow">{sortDir === 1 ? '↑' : '↓'}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredMutations as mut (`${mut.chain}-${mut.resNum}-${mut.mutRes}`)}
						<tr>
							<td class="pos-cell mono">{mut.chain}{mut.resNum}</td>
							<td class="mut-cell">{mut.wtRes} → {mut.mutRes}</td>
							<td>
								<span class="ss-badge ss-{mut.secStruct}"
									>{SS_LABELS[mut.secStruct] ?? mut.secStruct}</span
								>
							</td>
							<td class="num">{mut.accessibility.toFixed(1)}%</td>
							<td class="num">
								<span class="ddg-pill {ddgClass(mut.ddg)}"
									>{mut.ddg > 0 ? '+' : ''}{mut.ddg.toFixed(2)}</span
								>
							</td>
						</tr>
					{/each}
					{#if filteredMutations.length === 0}
						<tr>
							<td colspan="5" class="empty-cell">No mutations match the current filters</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* ── Header ── */
	.header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.tool-badge {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
		border-radius: 0.375rem;
		padding: 0.25rem 0.6rem;
		white-space: nowrap;
	}

	.page-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
		line-height: 1.3;
	}

	.page-sub {
		font-size: 0.8rem;
		color: var(--text-muted);
		display: block;
		margin-top: 0.15rem;
	}

	.action-btn {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.45rem 0.875rem;
		font-size: 0.85rem;
		color: var(--text);
		cursor: pointer;
		text-decoration: none;
		transition: border-color 0.15s;
		white-space: nowrap;
		align-self: center;
	}

	.action-btn:hover {
		border-color: var(--text-muted);
	}

	/* ── Tabs ── */
	.tabs {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0;
	}

	.tab {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: -1px;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.tab-count {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--text-muted);
		background: var(--border);
		border-radius: 999px;
		padding: 0.1rem 0.45rem;
	}

	.tab.active .tab-count {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent);
	}

	/* ── Filters ── */
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 2rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 1rem 1.25rem;
		align-items: flex-start;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.filter-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
		min-width: 60px;
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.pill {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0.2rem 0.65rem;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
	}

	.pill.active {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		color: var(--accent);
	}

	.range-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.range-input {
		width: 72px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.82rem;
		color: var(--text);
		text-align: center;
	}

	.range-sep,
	.range-unit {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.search-input {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.25rem 0.6rem;
		font-size: 0.82rem;
		color: var(--text);
		width: 120px;
		transition: border-color 0.15s;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	/* ── Table ── */
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		background: var(--surface);
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.65rem 0.875rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		background: var(--surface);
	}

	.data-table td {
		padding: 0.5rem 0.875rem;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		vertical-align: middle;
	}

	.data-table tbody tr:last-child td,
	.data-table tbody tr:last-child.detail-row td {
		border-bottom: none;
	}

	.data-table th.num,
	.data-table td.num {
		text-align: right;
	}

	.summary-row {
		cursor: pointer;
		transition: background 0.1s;
	}

	.summary-row:hover {
		background: color-mix(in srgb, var(--accent) 4%, transparent);
	}

	.summary-row.is-open {
		background: color-mix(in srgb, var(--accent) 6%, transparent);
	}

	.pos-cell {
		font-family: monospace;
		font-size: 0.875rem;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.mono {
		font-family: monospace;
	}

	.expand-icon {
		color: var(--text-muted);
		font-size: 0.7rem;
		width: 12px;
		flex-shrink: 0;
	}

	.res-cell {
		font-family: monospace;
		font-weight: 600;
	}

	.mut-cell {
		font-family: monospace;
	}

	/* ── Secondary structure badges ── */
	.ss-badge {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 600;
		border-radius: 0.25rem;
		padding: 0.1rem 0.4rem;
		white-space: nowrap;
	}

	.ss-H { background: #ede9fe; color: #6d28d9; }
	.ss-G { background: #ddd6fe; color: #7c3aed; }
	.ss-I { background: #e0e7ff; color: #4338ca; }
	.ss-E { background: #fef3c7; color: #92400e; }
	.ss-B { background: #fde68a; color: #78350f; }
	.ss-T { background: #ccfbf1; color: #0f766e; }
	.ss-S { background: #cffafe; color: #0e7490; }
	.ss-C { background: color-mix(in srgb, var(--border) 80%, transparent); color: var(--text-muted); }

	:root[data-theme='dark'] .ss-H { background: #2e1065; color: #c4b5fd; }
	:root[data-theme='dark'] .ss-G { background: #3b0764; color: #d8b4fe; }
	:root[data-theme='dark'] .ss-I { background: #1e1b4b; color: #a5b4fc; }
	:root[data-theme='dark'] .ss-E { background: #451a03; color: #fcd34d; }
	:root[data-theme='dark'] .ss-B { background: #422006; color: #fbbf24; }
	:root[data-theme='dark'] .ss-T { background: #042f2e; color: #5eead4; }
	:root[data-theme='dark'] .ss-S { background: #083344; color: #67e8f9; }

	/* ── ΔΔG pills ── */
	.ddg-pill {
		display: inline-block;
		font-family: monospace;
		font-size: 0.82rem;
		font-weight: 600;
		border-radius: 0.25rem;
		padding: 0.1rem 0.4rem;
		white-space: nowrap;
	}

	.ddg-ss { background: #bbf7d0; color: #14532d; }
	.ddg-sl { background: #dcfce7; color: #166534; }
	.ddg-dl { background: #ffedd5; color: #9a3412; }
	.ddg-ds { background: #fecaca; color: #7f1d1d; }

	:root[data-theme='dark'] .ddg-ss { background: #14532d; color: #86efac; }
	:root[data-theme='dark'] .ddg-sl { background: #166534; color: #bbf7d0; }
	:root[data-theme='dark'] .ddg-dl { background: #7c2d12; color: #fed7aa; }
	:root[data-theme='dark'] .ddg-ds { background: #7f1d1d; color: #fca5a5; }

	.green-val {
		color: #16a34a;
		font-family: monospace;
	}

	.orange-val {
		color: #ea580c;
		font-family: monospace;
	}

	/* ── Sortable header ── */
	.sortable {
		cursor: pointer;
		user-select: none;
	}

	.sortable:hover {
		color: var(--text);
	}

	.sort-active {
		color: var(--accent) !important;
	}

	.sort-arrow {
		opacity: 0.35;
		font-size: 0.7rem;
	}

	.sort-active .sort-arrow {
		opacity: 1;
		color: var(--accent);
	}

	/* ── Detail / bar chart ── */
	.detail-row td {
		padding: 0;
		background: color-mix(in srgb, var(--accent) 3%, var(--bg));
	}

	.detail-panel {
		padding: 1rem 1.25rem;
		border-top: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.detail-header {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	.bar-chart {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bar-row {
		display: grid;
		grid-template-columns: 56px 44px 1fr 64px;
		align-items: center;
		gap: 0.5rem;
	}

	.bar-label {
		font-family: monospace;
		font-size: 0.72rem;
		color: var(--text-muted);
		text-align: right;
	}

	.bar-mutname {
		font-family: monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text);
	}

	.bar-track {
		position: relative;
		height: 10px;
		background: var(--border);
		border-radius: 5px;
		overflow: hidden;
	}

	.bar-center-line {
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--text-muted);
		opacity: 0.4;
		transform: translateX(-50%);
	}

	.bar-fill {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 3px;
	}

	.bar-neg {
		background: #22c55e;
	}

	.bar-pos {
		background: #ef4444;
	}

	.bar-value {
		font-family: monospace;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: right;
	}

	/* ── Empty state ── */
	.empty-cell {
		text-align: center;
		color: var(--text-muted);
		font-size: 0.875rem;
		padding: 2.5rem !important;
	}

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.page {
			padding: 1.5rem 1rem;
		}

		.bar-row {
			grid-template-columns: 48px 40px 1fr 56px;
			gap: 0.35rem;
		}

		.filter-label {
			min-width: 50px;
		}
	}

	@media (max-width: 480px) {
		.header {
			flex-direction: column;
		}

		.tabs {
			overflow-x: auto;
		}
	}
</style>
