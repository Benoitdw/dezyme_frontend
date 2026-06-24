export interface HotSummaryRow {
	chain: string;
	resNum: number;
	resName: string;
	secStruct: string;
	accessibility: number;
	avgDtm: number;
	sumNegDtm: number;
	sumPosDtm: number;
}

export interface HotMutationRow {
	chain: string;
	resNum: number;
	wtRes: string;
	mutRes: string;
	secStruct: string;
	accessibility: number;
	dtm: number;
}

// Parse .hots (summary per position)
// Format: Chain ResNum WTRes SecStruct RSA AvgDtm SumNegDtm SumPosDtm
// Example: A   5  LYS C 100.00  -0.35  -7.87   1.19
export function parseHotsFile(text: string): HotSummaryRow[] {
	const rows: HotSummaryRow[] = [];
	for (const line of text.split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const parts = t.split(/\s+/);
		if (parts.length < 8) continue;
		const [chain, resNumStr, resName, secStruct, rsaStr, avgDtmStr, sumNegStr, sumPosStr] = parts;
		const resNum = parseInt(resNumStr, 10);
		if (isNaN(resNum)) continue;
		rows.push({
			chain,
			resNum,
			resName,
			secStruct,
			accessibility: parseFloat(rsaStr),
			avgDtm: parseFloat(avgDtmStr),
			sumNegDtm: parseFloat(sumNegStr),
			sumPosDtm: parseFloat(sumPosStr),
		});
	}
	return rows;
}

// Parse .hot (all mutations)
// Format: Chain ResNum WTRes MutRes SecStruct RSA Dtm
// Example: A   5  LYS ALA C 100.00  -0.13
export function parseHotFile(text: string): HotMutationRow[] {
	const rows: HotMutationRow[] = [];
	for (const line of text.split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const parts = t.split(/\s+/);
		if (parts.length < 7) continue;
		const [chain, resNumStr, wtRes, mutRes, secStruct, rsaStr, dtmStr] = parts;
		const resNum = parseInt(resNumStr, 10);
		if (isNaN(resNum)) continue;
		rows.push({
			chain,
			resNum,
			wtRes,
			mutRes,
			secStruct,
			accessibility: parseFloat(rsaStr),
			dtm: parseFloat(dtmStr),
		});
	}
	return rows;
}
