<script>
	import { base } from '$app/paths';
</script>

<div class="page">
	<h1>Help</h1>

	<section>
		<h2>Getting started</h2>
		<p>Dezyme gives you access to three protein mutation analysis tools: <strong>PopMuSiC</strong>, <strong>HoTMuSiC</strong>, and <strong>SNPMuSiC</strong>. Each tool accepts a protein structure and returns predictions for single-site mutations.</p>
	</section>

	<section>
		<h2>Step 1 — Select a tool</h2>
		<p>Choose the tool that matches your analysis goal from the tabs at the top of the <a href="{base}/run">run page</a>.</p>
		<ul>
			<li><strong>PopMuSiC</strong> — predicts the change in thermodynamic stability (ΔΔG) upon mutation.</li>
			<li><strong>HoTMuSiC</strong> — predicts the change in thermal stability (ΔTm) upon mutation.</li>
			<li><strong>SNPMuSiC</strong> — predicts the pathogenicity of missense SNPs.</li>
		</ul>
	</section>

	<section>
		<h2>Step 2 — Provide a structure</h2>
		<p>Enter a <strong>PDB ID</strong> (e.g. <code>3BIO</code>) or a <strong>UniProt accession</strong> (e.g. <code>P04637</code>) and click <em>Fetch</em>. The structure metadata and available chains will be loaded automatically. Alternatively, upload a <code>.pdb</code> file directly via the drop zone.</p>
	</section>

	<section>
		<h2>Step 3 — Select chains</h2>
		<p>Choose which protein chain(s) to analyse. Some tools work on a single chain; others accept multiple. The recommended selection is pre-filled automatically.</p>
	</section>

	<section>
		<h2>Step 4 — Run and retrieve results</h2>
		<p>Click the <em>Run</em> button to submit your job. You will be redirected to a results page where you can track progress and download the output once the analysis completes.</p>
	</section>

	<section>
		<h2>Contact</h2>
		<p>For questions or issues, reach out to the <a href="https://3biocompbio.github.io/3BIO-Bioinfo/" target="_blank" rel="noopener noreferrer">3BIO-BioInfo laboratory</a> or open an issue on our repository.</p>
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

	section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	h2 {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text);
	}

	p, li {
		font-size: 0.95rem;
		color: var(--text-muted);
		line-height: 1.7;
	}

	ul {
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	strong {
		color: var(--text);
		font-weight: 600;
	}

	code {
		font-family: ui-monospace, monospace;
		font-size: 0.875em;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		padding: 0.1em 0.4em;
	}

	a {
		color: #2563eb;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}
</style>
