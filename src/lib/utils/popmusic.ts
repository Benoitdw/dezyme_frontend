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
