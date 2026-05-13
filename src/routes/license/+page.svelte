<div class="page">
	<h1>License</h1>

	<div class="badge academic">Free for academic use</div>

	<section class="tier">
		<div class="tier-header">
			<span class="tier-label academic-label">Academic & Research</span>
			<span class="tier-price">Free</span>
		</div>
		<p>Dezyme and all its tools (PopMuSiC, HoTMuSiC, SNPMuSiC) are freely available to academic researchers, students, and non-profit research institutions. No registration is required.</p>
		<ul>
			<li>Unlimited analyses for research purposes</li>
			<li>Access to all tools and results</li>
			<li>Publication of results is permitted with appropriate citation</li>
		</ul>
		<p class="cite-note">If you use Dezyme in a publication, please cite the relevant tool papers. Citation information is available on the run page via the <em>Copy .bib reference</em> button.</p>
	</section>

	<section class="tier commercial-tier">
		<div class="tier-header">
			<span class="tier-label commercial-label">Commercial Use</span>
			<span class="tier-price">Contact us</span>
		</div>
		<p>Use of Dezyme for commercial purposes — including but not limited to pharmaceutical research, biotechnology, drug discovery, or any for-profit activity — requires a commercial license.</p>
		<ul>
			<li>Flexible licensing options tailored to your organisation's needs</li>
			<li>Priority support and dedicated infrastructure</li>
			<li>Custom integrations and API access available</li>
		</ul>
		<a
			href="mailto:fabrizio.pucci@ulb.be,marianne.rooman@ulb.be?subject=Dezyme%20commercial%20license%20inquiry"
			class="contact-btn"
		>Contact us about a license →</a>
	</section>

	<section>
		<h2>Disclaimer</h2>
		<p>Dezyme is provided "as is" without warranty of any kind. The 3BIO-BioInfo laboratory makes no guarantees regarding the accuracy or fitness for purpose of the predictions. Results should be interpreted by qualified researchers and are not a substitute for experimental validation.</p>
	</section>
</div>

<style>
	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: 3rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--text);
	}

	.badge {
		display: inline-block;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.3rem 0.85rem;
		border-radius: 999px;
		align-self: flex-start;
	}

	.badge.academic {
		background: #dcfce7;
		color: #166534;
	}

	.tier {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.commercial-tier {
		border-color: #2563eb40;
	}

	.tier-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.tier-label {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text);
	}

	.academic-label { color: #16a34a; }
	.commercial-label { color: #2563eb; }

	.tier-price {
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--text);
	}

	p, li {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.7;
	}

	ul {
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.cite-note {
		font-size: 0.82rem;
		font-style: italic;
		background: var(--bg);
		border-left: 3px solid var(--border);
		padding: 0.6rem 0.875rem;
		border-radius: 0 0.4rem 0.4rem 0;
	}

	.contact-btn {
		display: inline-block;
		margin-top: 0.25rem;
		background: #2563eb;
		color: #fff;
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.65rem 1.25rem;
		border-radius: 0.5rem;
		transition: opacity 0.15s;
		align-self: flex-start;
	}

	.contact-btn:hover {
		opacity: 0.88;
	}

	h2 {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 0.25rem;
	}

	section:last-child {
		border-top: 1px solid var(--border);
		padding-top: 1.5rem;
	}
</style>
