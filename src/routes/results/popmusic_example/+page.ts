import { parsePdbFile } from '$lib/utils/pdb';
import { parsePops, parsePop } from '$lib/utils/popmusic';
import { base } from '$app/paths';

export type { SummaryRow, MutationRow } from '$lib/utils/popmusic';

export async function load({ fetch }) {
	const prefix = `${base}/examples/popmusic/pop_example`;
	const [pdbText, popsText, popText] = await Promise.all([
		fetch(`${prefix}/p53.pdb`).then((r) => r.text()),
		fetch(`${prefix}/p53.pops`).then((r) => r.text()),
		fetch(`${prefix}/p53.pop`).then((r) => r.text())
	]);

	const meta = parsePdbFile(pdbText);
	// Override so the 3D viewer loads from RCSB and metadata is meaningful
	meta.id = '8E7B';

	const orgMatch = pdbText.match(/ORGANISM_SCIENTIFIC:\s*([^;]+)/i);
	if (orgMatch)
		meta.organism = orgMatch[1]
			.trim()
			.toLowerCase()
			.replace(/\b\w/g, (c) => c.toUpperCase());

	const resMatch = pdbText.match(/REMARK\s+2\s+RESOLUTION\.\s+([\d.]+)/);
	if (resMatch) meta.resolution = resMatch[1];

	const expMatch = pdbText.match(/^EXPDTA\s+(.+)/m);
	if (expMatch) meta.experimentType = expMatch[1].trim();

	return {
		meta,
		pdbUrl: `${prefix}/p53.pdb`,
		summary: parsePops(popsText),
		mutations: parsePop(popText)
	};
}
