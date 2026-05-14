<script>
	import { base } from '$app/paths';
</script>

<footer>
	<div class="footer-inner">
		<div class="footer-left">
			<span class="footer-org">3BIO</span>
			<span>av. Franklin Roosevelt, 50 CP 165/61 — 1050 Ixelles</span>
			<a href="mailto:fabrizio.pucci@ulb.be">Contact Us</a>
		</div>
		<div class="footer-right">
			<span>Tel. +32 (2) 650 36 15</span>
			<span>Fax. +32 (2) 650 35 75</span>
			<a href="{base}/license">Terms of use</a>
		</div>
	</div>
	<div class="footer-copy">
		Copyright 2014 – Dezyme – All rights reserved
	</div>
</footer>

<style>
	footer {
		border-top: 1px solid var(--border);
		background: var(--surface);
		padding: 1.25rem 2rem 1rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.footer-inner {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 3rem;
		margin-bottom: 0.75rem;
	}

	.footer-left,
	.footer-right {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
		align-items: center;
	}

	.footer-org {
		font-weight: 700;
		color: var(--text);
	}

	footer a {
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	footer a:hover {
		color: var(--text);
	}

	.footer-copy {
		font-size: 0.75rem;
		opacity: 0.6;
	}
</style>
