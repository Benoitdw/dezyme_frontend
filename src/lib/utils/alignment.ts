/**
 * Structure ↔ MSA alignment, as printed by PoPMuSiC-evol in STEP 1 of the run log:
 *
 *   • [Align target chain from 3D structure and target sequence]
 *     AlignedPositions(Struct['input_A'] -> Seq['query'])
 *     1 - 100
 *     MALLHSARVL…
 *     ||||||||||…
 *     MALLHSARVL…
 *     …
 *     - canonical positions:            [430 / 430] (100.00%)
 *
 * The log wraps the alignment at a fixed width; we stitch the blocks back into
 * two full-length strings so the viewer can re-wrap them to the available width.
 */

export type ColumnKind = 'match' | 'mismatch' | 'gap-struct' | 'gap-seq';

export interface StructureAlignment {
	/** Structure side label, e.g. 'input_A' */
	structLabel: string;
	/** Sequence side label, e.g. 'query' */
	seqLabel: string;
	structSeq: string;
	querySeq: string;
	/** Number of alignment columns */
	length: number;
	matches: number;
	mismatches: number;
	/** Columns where the structure has no residue (insertion in the MSA query) */
	structGaps: number;
	/** Columns where the MSA query has no residue */
	queryGaps: number;
	/** matches / length */
	identity: number;
	/** Raw text of the '- canonical positions:' line, when present */
	canonicalPositions: string | null;
	kinds: ColumnKind[];
}

const ANSI    = /\x1b\[[0-9;]*m/g;
const HEADER  = /AlignedPositions\(\s*Struct\['([^']*)'\]\s*->\s*Seq\['([^']*)'\]\s*\)/;
const RANGE   = /^\s*\d+\s*-\s*\d+\s*$/;
const CANON   = /canonical positions:\s*(.+?)\s*$/;
const RESIDUE = /^[A-Za-z*.\-]+$/;

/** Extract the structure↔sequence alignment from a run log, or null if absent. */
export function parseStructureAlignment(log: string | null | undefined): StructureAlignment | null {
	if (!log) return null;

	const lines = log.replace(ANSI, '').split('\n');
	const headerIdx = lines.findIndex((l) => HEADER.test(l));
	if (headerIdx === -1) return null;

	const [, structLabel, seqLabel] = lines[headerIdx].match(HEADER)!;

	let structSeq = '';
	let querySeq  = '';
	let canonicalPositions: string | null = null;

	for (let i = headerIdx + 1; i < lines.length; ) {
		const line = lines[i];

		if (RANGE.test(line)) {
			const top = lines[i + 1] ?? '';
			const bot = lines[i + 3] ?? '';
			// The middle line marks matches with '|' and gaps/mismatches with spaces, so
			// it cannot be trimmed — slice it at the same indent as the sequence lines.
			const indent = top.length - top.trimStart().length;
			const topSeq = top.slice(indent).trimEnd();
			const botSeq = bot.slice(indent).trimEnd();
			if (!RESIDUE.test(topSeq) || !RESIDUE.test(botSeq)) break;
			structSeq += topSeq;
			querySeq  += botSeq;
			i += 4;
			continue;
		}

		const canon = line.match(CANON);
		if (canon) { canonicalPositions = canon[1]; break; }

		// Blank separator lines inside the block are fine; anything else ends it.
		if (line.trim() === '') { i++; continue; }
		break;
	}

	const length = Math.min(structSeq.length, querySeq.length);
	if (length === 0) return null;

	const kinds: ColumnKind[] = new Array(length);
	let matches = 0, mismatches = 0, structGaps = 0, queryGaps = 0;

	for (let i = 0; i < length; i++) {
		const s = structSeq[i].toUpperCase();
		const q = querySeq[i].toUpperCase();
		if (s === '-' || s === '.') { kinds[i] = 'gap-struct'; structGaps++; }
		else if (q === '-' || q === '.') { kinds[i] = 'gap-seq'; queryGaps++; }
		else if (s === q) { kinds[i] = 'match'; matches++; }
		else { kinds[i] = 'mismatch'; mismatches++; }
	}

	return {
		structLabel,
		seqLabel,
		structSeq: structSeq.slice(0, length),
		querySeq:  querySeq.slice(0, length),
		length,
		matches,
		mismatches,
		structGaps,
		queryGaps,
		identity: matches / length,
		canonicalPositions,
		kinds,
	};
}
