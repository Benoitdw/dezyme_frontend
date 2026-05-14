<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	const status = $page.status;

	const content: Record<number, { title: string; sub: string; hint: string }> = {
		404: {
			title: 'Sequence not found',
			sub: 'The structure you are looking for has been cleaved or never existed.',
			hint: 'Check the URL or start a new analysis.'
		},
		403: {
			title: 'Access restricted',
			sub: 'You do not have permission to view this conformation.',
			hint: 'Try logging in or contact the administrator.'
		},
		500: {
			title: 'Unstable conformation',
			sub: 'An unexpected mutation occurred on our end. We are working to restore stability.',
			hint: 'Refreshing may resolve the issue.'
		},
		503: {
			title: 'Server folding…',
			sub: 'Our compute nodes are temporarily unavailable.',
			hint: 'Please try again in a few moments.'
		}
	};

	const { title, sub, hint } = content[status] ?? {
		title: 'Unexpected error',
		sub: $page.error?.message ?? 'Something went wrong during the analysis.',
		hint: 'Please try again or return home.'
	};

	let canvas = $state<HTMLCanvasElement | undefined>();

	onMount(() => {
		if (!canvas) return;

		const ctx = canvas.getContext('2d')!;
		let raf: number;

		const N = 28;
		const MAX_DIST = 140;

		interface Particle { x: number; y: number; vx: number; vy: number; r: number }
		let particles: Particle[] = [];

		function init() {
			canvas!.width  = canvas!.offsetWidth;
			canvas!.height = canvas!.offsetHeight;
			particles = Array.from({ length: N }, () => ({
				x:  Math.random() * canvas!.width,
				y:  Math.random() * canvas!.height,
				vx: (Math.random() - 0.5) * 0.5,
				vy: (Math.random() - 0.5) * 0.5,
				r:  Math.random() * 2.5 + 1.5,
			}));
		}

		function draw() {
			const W = canvas!.width, H = canvas!.height;
			ctx.clearRect(0, 0, W, H);

			for (const p of particles) {
				p.x += p.vx; p.y += p.vy;
				if (p.x < 0 || p.x > W) { p.vx *= -1; p.x = Math.max(0, Math.min(W, p.x)); }
				if (p.y < 0 || p.y > H) { p.vy *= -1; p.y = Math.max(0, Math.min(H, p.y)); }
			}

			for (let i = 0; i < N; i++) {
				for (let j = i + 1; j < N; j++) {
					const dx = particles[i].x - particles[j].x;
					const dy = particles[i].y - particles[j].y;
					const d  = Math.hypot(dx, dy);
					if (d < MAX_DIST) {
						ctx.beginPath();
						ctx.moveTo(particles[i].x, particles[i].y);
						ctx.lineTo(particles[j].x, particles[j].y);
						ctx.strokeStyle = `rgba(99,102,241,${(1 - d / MAX_DIST) * 0.35})`;
						ctx.lineWidth = 1;
						ctx.stroke();
					}
				}
			}

			for (const p of particles) {
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(99,102,241,0.55)';
				ctx.fill();
			}

			raf = requestAnimationFrame(draw);
		}

		init();
		draw();

		const ro = new ResizeObserver(init);
		ro.observe(canvas!);

		return () => { cancelAnimationFrame(raf); ro.disconnect(); };
	});
</script>

<div class="error-page">
	<canvas bind:this={canvas} class="particle-canvas" aria-hidden="true"></canvas>

	<div class="error-card">
		<div class="code-wrap">
			<span class="error-code" data-code={status}>{status}</span>
		</div>

		<div class="divider"></div>

		<h1 class="error-title">{title}</h1>
		<p class="error-sub">{sub}</p>
		<p class="error-hint">{hint}</p>

		<div class="actions">
			<a href="{base}/" class="btn btn-primary">← Home</a>
			<button class="btn btn-ghost" onclick={() => history.back()}>Go back</button>
		</div>
	</div>
</div>

<style>
	.error-page {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 57px - 110px);
		padding: 2rem;
		overflow: hidden;
	}

	/* ── Canvas background ── */
	.particle-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	/* ── Card ── */
	.error-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
		background: color-mix(in srgb, var(--surface) 85%, transparent);
		border: 1px solid var(--border);
		border-radius: 1.5rem;
		padding: 3rem 3.5rem;
		backdrop-filter: blur(12px);
		max-width: 480px;
		width: 100%;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
	}

	/* ── Glitch error code ── */
	.code-wrap {
		position: relative;
		line-height: 1;
	}

	.error-code {
		display: block;
		font-size: clamp(4.5rem, 14vw, 7.5rem);
		font-weight: 900;
		letter-spacing: -0.04em;
		color: #6366f1;
		position: relative;
		animation: pulse 4s ease-in-out infinite;
	}

	.error-code::before,
	.error-code::after {
		content: attr(data-code);
		position: absolute;
		inset: 0;
		font-weight: 900;
		letter-spacing: -0.04em;
	}

	.error-code::before {
		color: #ec4899;
		animation: glitch-top 4s infinite linear;
		clip-path: polygon(0 0, 100% 0, 100% 38%, 0 38%);
	}

	.error-code::after {
		color: #06b6d4;
		animation: glitch-bot 4s infinite linear;
		clip-path: polygon(0 62%, 100% 62%, 100% 100%, 0 100%);
	}

	@keyframes pulse {
		0%, 100% { filter: drop-shadow(0 0 18px rgba(99,102,241,0.25)); }
		50%       { filter: drop-shadow(0 0 32px rgba(99,102,241,0.45)); }
	}

	@keyframes glitch-top {
		0%, 80%, 100% { transform: none; opacity: 0; }
		82%  { transform: translate(-4px,  1px); opacity: 1; }
		84%  { transform: translate( 4px, -1px); opacity: 1; }
		86%  { transform: translate(-2px,  2px); opacity: 1; }
		88%  { transform: none; opacity: 0; }
	}

	@keyframes glitch-bot {
		0%, 83%, 100% { transform: none; opacity: 0; }
		85%  { transform: translate( 4px,  1px); opacity: 1; }
		87%  { transform: translate(-4px, -1px); opacity: 1; }
		89%  { transform: translate( 2px, -2px); opacity: 1; }
		91%  { transform: none; opacity: 0; }
	}

	/* ── Divider ── */
	.divider {
		width: 40px;
		height: 2px;
		background: linear-gradient(90deg, #6366f1, #ec4899);
		border-radius: 999px;
		opacity: 0.6;
	}

	/* ── Text ── */
	.error-title {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.error-sub {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.6;
		margin: 0;
	}

	.error-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
		opacity: 0.7;
		margin: 0;
		font-style: italic;
	}

	/* ── Actions ── */
	.actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		border-radius: 0.6rem;
		padding: 0.5rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s;
		border: 1px solid transparent;
	}

	.btn-primary {
		background: #6366f1;
		color: #fff;
		border-color: #6366f1;
	}

	.btn-primary:hover {
		background: #4f46e5;
		border-color: #4f46e5;
	}

	.btn-ghost {
		background: transparent;
		color: var(--text-muted);
		border-color: var(--border);
	}

	.btn-ghost:hover {
		background: var(--surface);
		color: var(--text);
	}

	@media (max-width: 480px) {
		.error-card {
			padding: 2rem 1.5rem;
		}
	}
</style>
