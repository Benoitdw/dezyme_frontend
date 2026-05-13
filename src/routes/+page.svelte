<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { toolList } from '$lib/tools';
	import { getRecentJobs } from '$lib/utils/storage';
	import type { StoredJob } from '$lib/utils/storage';

	const CYCLE      = 5000;
	const NODE_FRACS = [0.17, 0.50, 0.83];
	const SHINE_DUR  = 480;

	let recentJobs: StoredJob[] = $state([]);
	let typedText    = $state('');
	let showDetected = $state(false);
	let visibleRows  = $state(0);
	let shineIdx     = $state(-1);

	let step0: HTMLElement | undefined;
	let step1: HTMLElement | undefined;
	let step2: HTMLElement | undefined;

	const toolResults = [
		{
			tool: 'popmusic', accent: '#ec4899', title: 'PopMuSiC', subtitle: 'ΔΔG predictions',
			rows: [
				{ pos:  7, mut: 'Val → Ile', val: '−0.31', unit: 'kcal/mol', effect: 'stabilizing'   },
				{ pos: 12, mut: 'Phe → Tyr', val: '−0.67', unit: 'kcal/mol', effect: 'stabilizing'   },
				{ pos:  2, mut: 'Leu → Ala', val: '+1.84', unit: 'kcal/mol', effect: 'destabilizing' },
				{ pos: 18, mut: 'Lys → Arg', val: '−0.12', unit: 'kcal/mol', effect: 'neutral'       },
			]
		},
		{
			tool: 'hotmusic', accent: '#f59e0b', title: 'HoTMuSiC', subtitle: 'ΔTm predictions',
			rows: [
				{ pos:  7, mut: 'Val → Ile', val: '+1.2', unit: 'K', effect: 'stabilizing'   },
				{ pos: 12, mut: 'Phe → Tyr', val: '+2.1', unit: 'K', effect: 'stabilizing'   },
				{ pos:  2, mut: 'Leu → Ala', val: '−3.4', unit: 'K', effect: 'destabilizing' },
				{ pos: 18, mut: 'Lys → Arg', val: '+0.3', unit: 'K', effect: 'neutral'       },
			]
		},
		{
			tool: 'snpmusic', accent: '#10b981', title: 'SNPMuSiC', subtitle: 'ΔΔG for nsSNPs',
			rows: [
				{ pos:  7, mut: 'Val → Ile', val: '−0.28', unit: 'kcal/mol', effect: 'stabilizing'   },
				{ pos: 12, mut: 'Phe → Tyr', val: '+0.91', unit: 'kcal/mol', effect: 'destabilizing' },
				{ pos:  2, mut: 'Leu → Ala', val: '+1.54', unit: 'kcal/mol', effect: 'destabilizing' },
				{ pos: 18, mut: 'Lys → Arg', val: '−0.08', unit: 'kcal/mol', effect: 'neutral'       },
			]
		}
	];

	let activeToolPill = $state(0);  // cycles through tool pills in step 1

	let activePill   = $state(0);
	let activeResult = $state(0);
	let resultFading = $state(false);

	function cycleTo(idx: number) {
		if (idx === activePill) return;
		activePill = idx;
		resultFading = true;
		setTimeout(() => {
			activeResult = idx;
			resultFading = false;
		}, 260);
	}

	function cardOffset(i: number): number {
		let o = i - activeResult;
		if (o >  1) o -= toolList.length;
		if (o < -1) o += toolList.length;
		return o;
	}

	function animStep1() {
		const id = '3BIO';
		let i = 0;
		const t = setInterval(() => {
			typedText = id.slice(0, ++i);
			if (i === id.length) { clearInterval(t); setTimeout(() => (showDetected = true), 500); }
		}, 140);
	}

	function animStep2() {
		let r = 0;
		const t = setInterval(() => {
			visibleRows = ++r;
			if (r >= 2) clearInterval(t);
		}, 180);
	}

	onMount(() => {
		recentJobs = getRecentJobs();

		// Single dot with JS-timed node shines
		function scheduleShines() {
			NODE_FRACS.forEach((frac, i) => {
				setTimeout(() => {
					shineIdx = i;
					setTimeout(() => { if (shineIdx === i) shineIdx = -1; }, SHINE_DUR);
				}, frac * CYCLE);
			});
		}
		scheduleShines();
		const shineTimer = setInterval(scheduleShines, CYCLE);

		// Cycle tool pills in step 1
		const toolPillTimer = setInterval(() => {
			activeToolPill = (activeToolPill + 1) % toolList.length;
		}, 1400);

		// Auto-cycle results carousel
		const resultTimer = setInterval(() => {
			cycleTo((activePill + 1) % toolList.length);
		}, 3500);

		// IntersectionObserver for step reveal
		const animFns = [() => {}, animStep1, animStep2];
		const started  = [false, false, false];
		const obs = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				if (!e.isIntersecting) return;
				const idx = Number((e.target as HTMLElement).dataset.stepIdx);
				if (!started[idx]) {
					started[idx] = true;
					e.target.classList.add('visible');
					setTimeout(() => animFns[idx](), 350);
				}
			});
		}, { threshold: 0.3 });
		[step0, step1, step2].forEach((el) => { if (el) obs.observe(el); });

		return () => {
			clearInterval(shineTimer);
			clearInterval(toolPillTimer);
			clearInterval(resultTimer);
			obs.disconnect();
		};
	});
</script>

<!-- ── HERO ─────────────────────────────────────────── -->
<section class="hero">
	<div class="hero-glow" aria-hidden="true"></div>
	<div class="hero-inner">
		<h1>Mutation stability,<br />quantified.</h1>
		<p class="subtitle">
			Submit a protein structure, pick a tool, get quantitative predictions.
		</p>
		<a href="{base}/run" class="cta">Run an analysis →</a>
	</div>
</section>

<!-- ── PIPELINE ──────────────────────────────────────── -->
<section class="pipeline-section">
	<p class="pipeline-eyebrow">How it works</p>

	<div class="pipeline-wrap">
		<!-- Glowing fiber with a single flowing dot -->
		<div class="fiber" aria-hidden="true">
			<div class="fiber-dot"></div>
		</div>

		<!-- Step 1: Tool — LEFT -->
		<div class="p-step" data-step-idx="0" bind:this={step0}>
			<div class="p-body p-body--left">
				<span class="p-num">01</span>
				<h3 class="p-title">Tool</h3>
				<p class="p-desc">Choose a prediction model for your analysis.</p>
				<div class="p-ui p-ui--pills">
					{#each toolList as t, i}
						<a
							href="{base}/run?tool={t.id}"
							class="tool-pill"
							class:active={activeToolPill === i}
							style="--c:{t.accent}"
						>{t.name}</a>
					{/each}
				</div>
			</div>
			<div class="p-node" class:shine={shineIdx === 0} aria-hidden="true"></div>
			<div class="p-spacer"></div>
		</div>

		<!-- Step 2: Structure — RIGHT -->
		<div class="p-step" data-step-idx="1" bind:this={step1}>
			<div class="p-spacer"></div>
			<div class="p-node" class:shine={shineIdx === 1} aria-hidden="true"></div>
			<div class="p-body p-body--right">
				<span class="p-num">02</span>
				<h3 class="p-title">Structure</h3>
				<p class="p-desc">Submit any PDB ID or upload a structure file.</p>
				<div class="p-ui">
					<div class="fake-input">
						<span class="prompt">$</span>
						<span class="typed">{typedText}</span>
						{#if !showDetected}<span class="cursor">▌</span>{/if}
					</div>
					{#if showDetected}
						<p class="detected">✓ PDB ID detected — 3BIO</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Step 3: Results — LEFT -->
		<div class="p-step" data-step-idx="2" bind:this={step2}>
			<div class="p-body p-body--left p-body--results">
				<span class="p-num">03</span>
				<h3 class="p-title">Results</h3>
				<p class="p-desc">Explore predictions across every mutation site.</p>

				<!-- Tool tabs -->
				<div class="result-tabs">
					{#each toolResults as tr, i}
						<button
							class="result-tab"
							class:active={activePill === i}
							style="--c:{tr.accent}"
							onclick={() => cycleTo(i)}
							type="button"
						>{tr.title}</button>
					{/each}
				</div>

				<!-- Carousel with ghost panels -->
				<div class="result-carousel" class:fading={resultFading}>
					{#each toolResults as tr, i}
						{@const off = cardOffset(i)}
						<div
							class="result-card"
							class:card-center={off === 0}
							class:card-prev={off === -1}
							class:card-next={off === 1}
							style="--c:{tr.accent}"
						>
							<div class="rc-header">
								<span class="rc-name" style="color:{tr.accent}">{tr.title}</span>
								<span class="rc-sub">{tr.subtitle}</span>
							</div>
							<table class="mini-table">
								{#each tr.rows.slice(0, visibleRows) as row}
									<tr>
										<td class="mono muted">{row.pos}</td>
										<td class="mono">{row.mut}</td>
										<td
											class="mono fw"
											class:green={row.effect === 'stabilizing'}
											class:red={row.effect === 'destabilizing'}
										>{row.val}</td>
										<td class="mono small muted">{row.unit}</td>
										<td><span class="tag {row.effect}">{row.effect}</span></td>
									</tr>
								{/each}
							</table>
						</div>
					{/each}
				</div>
			</div>
			<div class="p-node" class:shine={shineIdx === 2} aria-hidden="true"></div>
			<div class="p-spacer"></div>
		</div>
	</div>
</section>

<!-- ── TOOLS ─────────────────────────────────────────── -->
<section class="tools-section">
	<div class="section-inner">
		<h2 class="section-title">Available tools</h2>
		<ul class="tool-list">
			{#each toolList as tool}
				<li>
					<a href="{base}/run?tool={tool.id}" class="tool-item">
						<div class="tool-accent-bar" style="background:{tool.accent}"></div>
						<div class="tool-body">
							<div class="tool-top">
								<span class="tool-name" style="color:{tool.accent}">{tool.name}</span>
								{#if tool.tags}
									<div class="tool-tags">
										{#each tool.tags.slice(0, 2) as tag}
											<span class="tool-tag">{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
							<p class="tool-desc">{tool.tagline}</p>
						</div>
						<span class="tool-arrow">Run →</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- ── RECENT JOBS ───────────────────────────────────── -->
{#if recentJobs.length > 0}
	<section class="recent-section">
		<div class="section-inner">
			<h2 class="section-title">Recent analyses</h2>
			<ul class="recent-list">
				{#each recentJobs as job}
					<li class="recent-item">
						<span class="recent-id">{job.id}</span>
						<a href="{base}/results/{job.id}" class="recent-link">Open →</a>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	/* ── HERO ────────────────────────────────────────── */
	.hero {
		position: relative;
		padding: 7rem 2rem 5rem;
		text-align: center;
		overflow: hidden;
	}

	.hero-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 70% 55% at 50% 0%,
			color-mix(in srgb, #6366f1 14%, transparent),
			transparent 70%
		);
		pointer-events: none;
		animation: glow-pulse 5s ease-in-out infinite;
	}

	@keyframes glow-pulse {
		0%, 100% { opacity: 0.7; }
		50%       { opacity: 1; }
	}

	.hero-inner {
		position: relative;
		z-index: 1;
		max-width: 560px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}

	h1 {
		font-size: clamp(2.5rem, 5.5vw, 4.25rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.1;
		color: var(--text);
	}

	.subtitle {
		font-size: 1.05rem;
		color: var(--text-muted);
		max-width: 420px;
		line-height: 1.6;
	}

	.cta {
		display: inline-block;
		background: #6366f1;
		color: #fff;
		font-weight: 700;
		font-size: 0.95rem;
		padding: 0.7rem 1.75rem;
		border-radius: 0.625rem;
		text-decoration: none;
		transition: opacity 0.15s, transform 0.15s;
	}

	.cta:hover {
		opacity: 0.88;
		transform: translateY(-1px);
	}

	/* ── PIPELINE ────────────────────────────────────── */
	.pipeline-section {
		padding: 5rem 2rem 5rem;
		border-top: 1px solid var(--border);
	}

	.pipeline-eyebrow {
		text-align: center;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		margin-bottom: 4rem;
	}

	.pipeline-wrap {
		position: relative;
		max-width: 820px;
		margin: 0 auto;
	}

	/* Fiber line */
	.fiber {
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 2px;
		transform: translateX(-50%);
		background: linear-gradient(
			to bottom,
			transparent 0%,
			color-mix(in srgb, #6366f1 55%, transparent) 6%,
			color-mix(in srgb, #6366f1 55%, transparent) 94%,
			transparent 100%
		);
		box-shadow: 0 0 16px color-mix(in srgb, #6366f1 15%, transparent);
		pointer-events: none;
	}

	/* Single dot traveling down */
	.fiber-dot {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #a5b4fc;
		box-shadow: 0 0 8px #6366f1, 0 0 18px rgba(99, 102, 241, 0.5);
		animation: dot-travel 5s linear infinite;
	}

	@keyframes dot-travel {
		0%   { top: 0%;   opacity: 0; }
		4%   { opacity: 1; }
		96%  { opacity: 1; }
		100% { top: 100%; opacity: 0; }
	}

	/* Step rows — 3-col grid: content | node | content */
	.p-step {
		display: grid;
		grid-template-columns: 1fr 14px 1fr;
		align-items: center;
		min-height: 280px;
		opacity: 0;
		transform: translateY(24px);
		transition: opacity 0.7s ease, transform 0.7s ease;
	}

	.p-step.visible {
		opacity: 1;
		transform: none;
	}

	/* Results step: taller to fit carousel */
	.p-body--results {
		min-height: 300px;
	}

	.p-body--left {
		padding-right: 3.5rem;
		text-align: right;
	}

	.p-body--left .p-ui {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.p-body--right {
		padding-left: 3.5rem;
	}

	.p-body--right .p-ui {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	/* Node dot */
	.p-node {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #6366f1;
		justify-self: center;
		position: relative;
		z-index: 1;
		box-shadow:
			0 0 0 4px color-mix(in srgb, #6366f1 15%, transparent),
			0 0 20px color-mix(in srgb, #6366f1 55%, transparent);
		transition: box-shadow 0.1s ease;
	}

	/* Node shine burst when dot crosses */
	.p-node.shine {
		animation: node-shine 0.48s ease-out;
	}

	@keyframes node-shine {
		0%   {
			box-shadow:
				0 0 0 4px  color-mix(in srgb, #6366f1 15%, transparent),
				0 0 20px   color-mix(in srgb, #6366f1 55%, transparent);
			transform: scale(1);
		}
		35%  {
			box-shadow:
				0 0 0 10px color-mix(in srgb, #6366f1 25%, transparent),
				0 0 48px   color-mix(in srgb, #6366f1 90%, transparent),
				0 0 90px   color-mix(in srgb, #818cf8 50%, transparent);
			transform: scale(1.45);
		}
		100% {
			box-shadow:
				0 0 0 4px  color-mix(in srgb, #6366f1 15%, transparent),
				0 0 20px   color-mix(in srgb, #6366f1 55%, transparent);
			transform: scale(1);
		}
	}

	/* Step typography */
	.p-num {
		display: block;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #6366f1;
		font-family: monospace;
		margin-bottom: 0.3rem;
	}

	.p-title {
		font-size: 1.6rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text);
		margin: 0 0 0.35rem;
	}

	.p-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.55;
		margin: 0 0 0.85rem;
	}

	/* Pills row layout for step 1 */
	.p-ui--pills {
		flex-direction: row !important;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 0.5rem !important;
	}

	/* Tool pills — real links */
	.tool-pill {
		display: inline-block;
		padding: 0.4rem 1.1rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
		background: transparent;
		text-decoration: none;
		transition: color 0.25s, background 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.15s;
	}

	.tool-pill:hover {
		color: var(--c);
		background: color-mix(in srgb, var(--c) 10%, transparent);
		border-color: color-mix(in srgb, var(--c) 40%, transparent);
		transform: translateY(-1px);
	}

	.tool-pill.active {
		color: var(--c);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		border-color: color-mix(in srgb, var(--c) 45%, transparent);
		box-shadow: 0 0 18px color-mix(in srgb, var(--c) 30%, transparent);
	}

	/* Step 2 — fake terminal */
	.fake-input {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.5rem 0.9rem;
		font-family: monospace;
		font-size: 0.9rem;
		color: var(--text);
	}

	.prompt { color: #6366f1; font-weight: 700; }

	.cursor {
		color: #6366f1;
		animation: blink 1s step-end infinite;
	}

	@keyframes blink { 50% { opacity: 0; } }

	.detected {
		font-size: 0.8rem;
		color: #34d399;
		font-family: monospace;
		animation: fade-up 0.4s ease;
	}

	@keyframes fade-up {
		from { opacity: 0; transform: translateY(4px); }
		to   { opacity: 1; transform: none; }
	}

	/* ── RESULTS CAROUSEL ────────────────────────────── */
	.result-tabs {
		display: flex;
		gap: 0.375rem;
		margin-bottom: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 0.25rem;
	}

	.result-tab {
		background: none;
		border: none;
		border-radius: 0.5rem;
		padding: 0.45rem 1.1rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.18s, background 0.18s;
	}

	.result-tab.active {
		background: var(--bg);
		color: var(--c);
	}

	.result-carousel {
		position: relative;
		width: 100%;
		height: 190px;
		overflow: hidden;
		transition: opacity 0.26s ease;
	}

	.result-carousel.fading {
		opacity: 0.12;
	}

	.result-card {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: 0 -50%;
		width: 320px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 1rem 1.25rem;
		transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1),
		            opacity 0.45s ease,
		            filter 0.45s ease,
		            border-color 0.45s ease;
		pointer-events: none;
		user-select: none;
	}

	/* Center (active) card */
	.card-center {
		transform: translateX(-50%);
		opacity: 1;
		z-index: 2;
		pointer-events: auto;
		border-color: color-mix(in srgb, var(--c) 35%, var(--border));
		box-shadow: 0 0 24px color-mix(in srgb, var(--c) 14%, transparent);
	}

	/* Ghost cards — peek from sides */
	.card-prev {
		transform: translateX(calc(-50% - 360px)) scale(0.9);
		opacity: 0.25;
		z-index: 1;
		filter: blur(1.5px);
	}

	.card-next {
		transform: translateX(calc(-50% + 360px)) scale(0.9);
		opacity: 0.25;
		z-index: 1;
		filter: blur(1.5px);
	}

	.rc-header {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.85rem;
	}

	.rc-name {
		font-size: 0.95rem;
		font-weight: 700;
	}

	.rc-sub {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	/* Mini results table */
	.mini-table {
		border-collapse: collapse;
		font-size: 0.82rem;
		width: 100%;
	}

	.mini-table tr { animation: row-appear 0.28s ease both; }

	@keyframes row-appear {
		from { opacity: 0; transform: translateY(5px); }
		to   { opacity: 1; transform: none; }
	}

	.mini-table td {
		padding: 0.28rem 0.55rem 0.28rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		color: var(--text);
		text-align: left;
	}

	.mini-table tr:last-child td { border-bottom: none; }

	.mono  { font-family: monospace; }
	.muted { color: var(--text-muted); }
	.fw    { font-weight: 600; }
	.small { font-size: 0.75rem; }
	.green { color: #34d399; }
	.red   { color: #f87171; }

	.tag {
		font-size: 0.68rem;
		font-weight: 600;
		border-radius: 0.25rem;
		padding: 0.1rem 0.4rem;
		white-space: nowrap;
	}
	.tag.destabilizing { background: color-mix(in srgb, #f87171 12%, transparent); color: #f87171; }
	.tag.stabilizing   { background: color-mix(in srgb, #34d399 12%, transparent); color: #34d399; }
	.tag.neutral       { background: color-mix(in srgb, #94a3b8 12%, transparent); color: #94a3b8; }

	/* ── TOOLS ───────────────────────────────────────── */
	.tools-section,
	.recent-section {
		padding: 3rem 1.5rem;
		border-top: 1px solid var(--border);
	}

	.section-inner {
		max-width: 700px;
		margin: 0 auto;
	}

	.section-title {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 1.25rem;
	}

	.tool-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tool-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 1.25rem 1.25rem 1.25rem 0;
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s, transform 0.15s;
	}

	.tool-item:hover {
		border-color: color-mix(in srgb, var(--text-muted) 50%, transparent);
		transform: translateY(-1px);
	}

	.tool-accent-bar {
		width: 3px;
		align-self: stretch;
		border-radius: 0 2px 2px 0;
		flex-shrink: 0;
	}

	.tool-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.tool-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.tool-name  { font-size: 1rem; font-weight: 700; }
	.tool-tags  { display: flex; gap: 0.4rem; }

	.tool-tag {
		font-size: 0.7rem;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--text-muted) 20%, transparent);
		border-radius: 0.25rem;
		padding: 0.1rem 0.45rem;
	}

	.tool-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.tool-arrow {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-muted);
		flex-shrink: 0;
		padding-right: 0.25rem;
	}

	/* ── RECENT ──────────────────────────────────────── */
	.recent-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.recent-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.6rem 1rem;
		font-size: 0.875rem;
	}

	.recent-id   { font-family: monospace; color: var(--text-muted); }
	.recent-link { color: var(--text); text-decoration: none; font-weight: 600; }
	.recent-link:hover { text-decoration: underline; }

	/* ── MOBILE ──────────────────────────────────────── */
	@media (max-width: 640px) {
		.pipeline-wrap { padding: 0 1rem; }

		.fiber, .p-node, .p-spacer { display: none; }

		.p-step {
			grid-template-columns: 1fr;
			min-height: auto;
			padding: 2.5rem 0;
			border-bottom: 1px solid var(--border);
		}

		.p-step:last-child { border-bottom: none; }

		.p-body--left,
		.p-body--right {
			text-align: left;
			padding: 0;
		}

		.p-body--left .p-ui,
		.p-body--right .p-ui {
			align-items: flex-start;
		}

		.p-ui--pills {
			justify-content: flex-start;
		}

		.result-carousel { height: 240px; }
		.result-card { width: 260px; }
		.card-prev { transform: translateX(calc(-50% - 290px)) scale(0.9); }
		.card-next { transform: translateX(calc(-50% + 290px)) scale(0.9); }
	}
</style>
