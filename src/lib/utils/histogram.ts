export interface Histogram {
	edges: number[];    // lower edge of each bin
	counts: number[];
	binWidth: number;
}

const NICE_WIDTHS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];

/**
 * Bins that cover the whole data range. Values are never clamped into the first
 * or last bin, which would pile the outliers into an artificial edge spike, and
 * empty margins are not drawn either — the range follows the data.
 *
 * `preferredWidth` is the bin width to use when the range allows it; a wider one
 * from NICE_WIDTHS is picked when it would otherwise produce more than `maxBins`.
 */
export function buildHistogram(values: number[], preferredWidth: number, maxBins = 60): Histogram {
	const finite = values.filter((v) => Number.isFinite(v));
	if (finite.length === 0) return { edges: [], counts: [], binWidth: preferredWidth };

	let min = finite[0];
	let max = finite[0];
	for (const v of finite) {
		if (v < min) min = v;
		if (v > max) max = v;
	}

	const span = max - min || preferredWidth;
	const binWidth =
		NICE_WIDTHS.find((w) => w >= preferredWidth && span / w <= maxBins) ??
		Math.pow(10, Math.ceil(Math.log10(span / maxBins)));

	const lo = Math.floor(min / binWidth) * binWidth;
	const nBins = Math.max(1, Math.ceil((max - lo) / binWidth));
	const counts: number[] = new Array(nBins).fill(0);
	for (const v of finite) {
		// The last bin is closed on the right so that the maximum falls inside it
		counts[Math.min(Math.floor((v - lo) / binWidth), nBins - 1)]++;
	}

	const round = (x: number) => Math.round(x * 1e6) / 1e6;
	return { edges: counts.map((_, i) => round(lo + i * binWidth)), counts, binWidth };
}

/** "[-1.2, -1.0)" — the interval a bin covers, closed on the right for the last one */
export function formatBinRange(hist: Histogram, index: number, decimals: number): string {
	const lo = hist.edges[index];
	const hi = lo + hist.binWidth;
	const isLast = index === hist.edges.length - 1;
	return `[${lo.toFixed(decimals)}, ${hi.toFixed(decimals)}${isLast ? ']' : ')'}`;
}

/** Decimals needed to write a bin edge unambiguously */
export function binDecimals(binWidth: number): number {
	return binWidth < 0.1 ? 2 : 1;
}
