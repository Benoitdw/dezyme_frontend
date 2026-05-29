// ── Legacy types (used by [id] dynamic results page) ─────────────────────────

export interface SummaryRow {
	chain: string;
	resNum: number;
	resName: string;
	secStruct: string;
	accessibility: number;
	avgDdg: number;
	sumNegDdg: number;
	sumPosDdg: number;
}

export interface MutationRow {
	chain: string;
	resNum: number;
	wtRes: string;
	mutRes: string;
	secStruct: string;
	accessibility: number;
	ddg: number;
}

export function parsePops(text: string): SummaryRow[] {
	return text
		.split('\n')
		.filter((l) => l.trim() && !l.startsWith('#'))
		.map((l) => {
			const t = l.trim().split(/\s+/);
			if (t.length < 8) return null;
			return {
				chain: t[0],
				resNum: parseInt(t[1]),
				resName: t[2],
				secStruct: t[3],
				accessibility: parseFloat(t[4]),
				avgDdg: parseFloat(t[5]),
				sumNegDdg: parseFloat(t[6]),
				sumPosDdg: parseFloat(t[7])
			};
		})
		.filter((r): r is SummaryRow => r !== null && !isNaN(r.resNum));
}

export function parsePop(text: string): MutationRow[] {
	return text
		.split('\n')
		.filter((l) => l.trim() && !l.startsWith('#'))
		.map((l) => {
			const t = l.trim().split(/\s+/);
			if (t.length < 7) return null;
			return {
				chain: t[0],
				resNum: parseInt(t[1]),
				wtRes: t[2],
				mutRes: t[3],
				secStruct: t[4],
				accessibility: parseFloat(t[5]),
				ddg: parseFloat(t[6])
			};
		})
		.filter((r): r is MutationRow => r !== null && !isNaN(r.resNum));
}

// ── PopMusicEvol types & parsers ─────────────────────────────────────────────

export interface EvolMutationRow {
	mutation_pdb: string;
	mutation_msa: string;
	is_in_structure: boolean;
	is_in_msa: boolean;
	wt: string; // 3-letter WT residue
	RSA: number;
	secondary_structure: string;
	pLDDT: number;
	gap_ratio: number;
	DV: number; // main ΔΔG prediction
	StructureDCA: number;
	StructureDCAn: number;
	// parsed from mutation strings
	chain: string;
	resNumPdb: number;
	msaPos: number;
	wtAa: string; // 1-letter WT
	mutAa: string; // 1-letter mutant
}

export interface PositionInfo {
	msaPos: number;
	chain: string;
	resNumPdb: number;
	wtAa: string;
	wt3: string; // 3-letter WT
	RSA: number;
	secondary_structure: string;
	pLDDT: number;
	gap_ratio: number;
	meanDV: number;
	meanStructureDCA: number;
	mutations: Map<string, EvolMutationRow>; // 1-letter mutant AA → row
}

export function parseMutationsCSV(text: string): EvolMutationRow[] {
	const lines = text.split('\n');
	if (lines.length < 2) return [];
	const header = lines[0].split(',');
	const idx = (name: string) => header.indexOf(name);

	const cols = {
		mutation_pdb: idx('mutation_pdb'),
		mutation_msa: idx('mutation_msa'),
		is_in_structure: idx('is_in_structure'),
		is_in_msa: idx('is_in_msa'),
		wt: idx('wt'),
		RSA: idx('RSA'),
		secondary_structure: idx('secondary_structure'),
		pLDDT: idx('pLDDT'),
		gap_ratio: idx('gap_ratio'),
		DV: idx('DV'),
		StructureDCA: idx('StructureDCA'),
		StructureDCAn: idx('StructureDCAn')
	};

	const rows: EvolMutationRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		const t = line.split(',');

		const mutation_pdb = t[cols.mutation_pdb] ?? '';
		const mutation_msa = t[cols.mutation_msa] ?? '';

		// Single-mutation format: {WT}{Chain}{ResNum}{Mut} e.g. "VA1A"
		const pdbMatch = mutation_pdb.match(/^([A-Z])([A-Z])(-?\d+)([A-Z])$/);
		if (!pdbMatch) continue;

		// MSA format: {WT}{Pos}{Mut} e.g. "V1A"
		const msaMatch = mutation_msa.match(/^([A-Z])(-?\d+)([A-Z])$/);
		if (!msaMatch) continue;

		rows.push({
			mutation_pdb,
			mutation_msa,
			is_in_structure: t[cols.is_in_structure] === 'True',
			is_in_msa: t[cols.is_in_msa] === 'True',
			wt: t[cols.wt] ?? '',
			RSA: parseFloat(t[cols.RSA]) || 0,
			secondary_structure: t[cols.secondary_structure] ?? 'C',
			pLDDT: parseFloat(t[cols.pLDDT]) || 0,
			gap_ratio: parseFloat(t[cols.gap_ratio]) || 0,
			DV: parseFloat(t[cols.DV]) || 0,
			StructureDCA: parseFloat(t[cols.StructureDCA]) || 0,
			StructureDCAn: parseFloat(t[cols.StructureDCAn]) || 0,
			chain: pdbMatch[2],
			resNumPdb: parseInt(pdbMatch[3]),
			msaPos: parseInt(msaMatch[2]),
			wtAa: pdbMatch[1],
			mutAa: pdbMatch[4]
		});
	}
	return rows;
}

export function groupByPosition(rows: EvolMutationRow[]): PositionInfo[] {
	const map = new Map<number, PositionInfo>();

	for (const row of rows) {
		if (!map.has(row.msaPos)) {
			map.set(row.msaPos, {
				msaPos: row.msaPos,
				chain: row.chain,
				resNumPdb: row.resNumPdb,
				wtAa: row.wtAa,
				wt3: row.wt,
				RSA: row.RSA,
				secondary_structure: row.secondary_structure,
				pLDDT: row.pLDDT,
				gap_ratio: row.gap_ratio,
				meanDV: 0,
				meanStructureDCA: 0,
				mutations: new Map()
			});
		}
		map.get(row.msaPos)!.mutations.set(row.mutAa, row);
	}

	for (const pos of map.values()) {
		const muts = [...pos.mutations.values()];
		if (muts.length > 0) {
			pos.meanDV = muts.reduce((s, r) => s + r.DV, 0) / muts.length;
			pos.meanStructureDCA = muts.reduce((s, r) => s + r.StructureDCA, 0) / muts.length;
		}
	}

	return [...map.values()].sort((a, b) => a.msaPos - b.msaPos);
}
