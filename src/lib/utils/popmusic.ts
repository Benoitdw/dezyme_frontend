export interface EvolMutationRow {
	mutation_pdb: string;
	mutation_msa: string;
	is_in_structure: boolean;
	is_in_msa: boolean;
	is_nonstandard_aa: boolean;
	wt: string; // 3-letter WT residue
	RSA: number;
	secondary_structure: string;
	pLDDT: number;
	gap_ratio: number;
	ddg: number;        // PoPMuSiCv3 — final combined score
	ddgStr: number;     // PoPMuSiCv3_str — structure-only score
	ddgStrEvol: number; // PoPMuSiCv3_str+evol
	StructureDCA: number;
	StructureDCAn: number;
	SaProt: number;
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
	meanDdg: number;
	meanDdgStr: number;
	meanDdgStrEvol: number;
	meanStructureDCA: number;
	mutations: Map<string, EvolMutationRow>; // 1-letter mutant AA → row
}

export function parseMutationsCSV(text: string): EvolMutationRow[] {
	const lines = text.split('\n');
	if (lines.length < 2) return [];
	const header = lines[0].split(',').map(h => h.trim());
	const idx = (name: string) => header.indexOf(name);

	const cols = {
		mutation_pdb:       idx('mutation_pdb'),
		mutation_msa:       idx('mutation_msa'),
		is_in_structure:    idx('is_in_structure'),
		is_in_msa:          idx('is_in_msa'),
		is_nonstandard_aa:  idx('is_nonstandard_aa'),
		wt:                 idx('wt'),
		RSA:                idx('RSA'),
		secondary_structure: idx('secondary_structure'),
		pLDDT:              idx('pLDDT'),
		gap_ratio:          idx('gap_ratio'),
		ddg:                idx('PoPMuSiCv3'),
		ddgStr:             idx('PoPMuSiCv3_str'),
		ddgStrEvol:         idx('PoPMuSiCv3_str+evol'),
		StructureDCA:       idx('StructureDCA'),
		StructureDCAn:      idx('StructureDCAn'),
		SaProt:             idx('SaProt'),
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
			is_in_structure:   t[cols.is_in_structure] === 'True',
			is_in_msa:         t[cols.is_in_msa] === 'True',
			is_nonstandard_aa: t[cols.is_nonstandard_aa] === 'True',
			wt:                t[cols.wt] ?? '',
			RSA:               parseFloat(t[cols.RSA]) || 0,
			secondary_structure: t[cols.secondary_structure] ?? 'C',
			pLDDT:             parseFloat(t[cols.pLDDT]) || 0,
			gap_ratio:         parseFloat(t[cols.gap_ratio]) || 0,
			ddg:               parseFloat(t[cols.ddg]) || 0,
			ddgStr:            parseFloat(t[cols.ddgStr]) || 0,
			ddgStrEvol:        parseFloat(t[cols.ddgStrEvol]) || 0,
			StructureDCA:      parseFloat(t[cols.StructureDCA]) || 0,
			StructureDCAn:     parseFloat(t[cols.StructureDCAn]) || 0,
			SaProt:            parseFloat(t[cols.SaProt]) || 0,
			chain:             pdbMatch[2],
			resNumPdb:         parseInt(pdbMatch[3]),
			msaPos:            parseInt(msaMatch[2]),
			wtAa:              pdbMatch[1],
			mutAa:             pdbMatch[4]
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
				meanDdg: 0,
				meanDdgStr: 0,
				meanDdgStrEvol: 0,
				meanStructureDCA: 0,
				mutations: new Map()
			});
		}
		map.get(row.msaPos)!.mutations.set(row.mutAa, row);
	}

	for (const pos of map.values()) {
		const muts = [...pos.mutations.values()];
		if (muts.length > 0) {
			pos.meanDdg           = muts.reduce((s, r) => s + r.ddg, 0) / muts.length;
			pos.meanDdgStr        = muts.reduce((s, r) => s + r.ddgStr, 0) / muts.length;
			pos.meanDdgStrEvol    = muts.reduce((s, r) => s + r.ddgStrEvol, 0) / muts.length;
			pos.meanStructureDCA  = muts.reduce((s, r) => s + r.StructureDCA, 0) / muts.length;
		}
	}

	return [...map.values()].sort((a, b) => a.msaPos - b.msaPos);
}
