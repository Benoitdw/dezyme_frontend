<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';

	const STORAGE_KEY = 'dezyme_academic_confirmed';

	let visible = $state(false);

	if (browser && !localStorage.getItem(STORAGE_KEY)) {
		visible = true;
	}

	function confirmAcademic() {
		localStorage.setItem(STORAGE_KEY, '1');
		visible = false;
	}

	function goCommercial() {
		visible = false;
		goto(`${base}/license`);
	}
</script>

{#if visible}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="gate-title">
		<div class="modal">
			<div class="dna-icon" aria-hidden="true">
				<svg viewBox="0 0 48 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="36">
					<path d="M16 6 C10 18, 22 28, 16 40 C10 52, 22 62, 16 74" stroke="#2563eb" stroke-width="3" stroke-linecap="round" fill="none"/>
					<path d="M32 6 C38 18, 26 28, 32 40 C38 52, 26 62, 32 74" stroke="#2563eb" stroke-width="3" stroke-linecap="round" fill="none"/>
					<line x1="16" y1="14" x2="32" y2="14" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
					<line x1="14" y1="26" x2="34" y2="26" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
					<line x1="16" y1="40" x2="32" y2="40" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
					<line x1="14" y1="54" x2="34" y2="54" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
					<line x1="16" y1="66" x2="32" y2="66" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
				</svg>
			</div>

			<h2 id="gate-title">Welcome to Dezyme</h2>
			<p class="subtitle">Protein mutation analysis tools by the <strong>3BIO-BioInfo Laboratory</strong></p>

			<p class="question">Are you using Dezyme for academic or research purposes?</p>

			<div class="actions">
				<button class="btn-primary" onclick={confirmAcademic}>
					Yes, Academic / Research Use
				</button>
				<button class="btn-secondary" onclick={goCommercial}>
					No, Commercial Use
				</button>
			</div>

			<p class="note">
				Dezyme is free for academic use. Commercial users must obtain a license.
				<a href="{base}/license">Learn more</a>
			</p>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1rem;
	}

	.modal {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 1.25rem;
		padding: 2.5rem 2rem;
		max-width: 440px;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
	}

	.dna-icon {
		margin-bottom: 0.25rem;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--text);
	}

	.subtitle {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-top: -0.25rem;
	}

	.subtitle strong {
		color: var(--text);
		font-weight: 600;
	}

	.question {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		margin-top: 0.5rem;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
		margin-top: 0.25rem;
	}

	.btn-primary {
		background: #2563eb;
		color: #fff;
		border: none;
		border-radius: 0.625rem;
		padding: 0.8rem 1rem;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s;
		width: 100%;
	}

	.btn-primary:hover {
		opacity: 0.88;
	}

	.btn-secondary {
		background: none;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		padding: 0.8rem 1rem;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		width: 100%;
	}

	.btn-secondary:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.note {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.note a {
		color: #2563eb;
		text-decoration: none;
	}

	.note a:hover {
		text-decoration: underline;
	}
</style>
