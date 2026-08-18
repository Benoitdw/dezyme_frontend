export type RGB = [number, number, number];

// AlphaFold confidence palette, as given by the reference matplotlib colormaps
const AF_DARK_BLUE:  RGB = [0.000, 0.325, 0.839];  // high confidence
const AF_LIGHT_BLUE: RGB = [0.396, 0.796, 0.953];  // medium-high confidence
const AF_YELLOW:     RGB = [1.000, 0.859, 0.075];  // medium-low confidence
const AF_ORANGE:     RGB = [1.000, 0.490, 0.271];  // low confidence
const AF_RED:        RGB = [1.000, 0.271, 0.271];  // low confidence

const RSA_BURIED: RGB = [0.0, 0.373, 0.451];  // deep blue
const RSA_EXPOSED: RGB = [1.0, 1.0, 1.0];     // white

function toBytes(c: RGB): RGB {
	return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)];
}

/**
 * matplotlib's LinearSegmentedColormap.from_list: the stops are spread evenly
 * over [0, 1] and each channel is interpolated linearly between them.
 */
export function linearColormap(stops: RGB[]): (t: number) => RGB {
	return (t: number) => {
		const clamped = Math.max(0, Math.min(1, t));
		const scaled = clamped * (stops.length - 1);
		const i = Math.min(Math.floor(scaled), stops.length - 2);
		const f = scaled - i;
		const a = stops[i];
		const b = stops[i + 1];
		return toBytes([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
	};
}

/**
 * matplotlib's ListedColormap + BoundaryNorm: `boundaries` has one more entry
 * than `colors`, each bin is closed on the left, the last one on both sides.
 */
export function boundaryColormap(colors: RGB[], boundaries: number[]): (v: number) => RGB {
	const bytes = colors.map(toBytes);
	return (v: number) => {
		if (v <= boundaries[0]) return bytes[0];
		for (let i = 0; i < bytes.length; i++) {
			if (v < boundaries[i + 1]) return bytes[i];
		}
		return bytes[bytes.length - 1];
	};
}

const gapRatioMap = linearColormap([AF_DARK_BLUE, AF_LIGHT_BLUE, AF_YELLOW, AF_ORANGE, AF_RED]);
const plddtMap    = boundaryColormap([AF_ORANGE, AF_YELLOW, AF_LIGHT_BLUE, AF_DARK_BLUE], [0, 50, 70, 90, 100]);
const rsaMap      = linearColormap([RSA_BURIED, RSA_EXPOSED]);

// ── Heatmap colorFn adapters (v, vmin, vmax, dark) ───────────────────────────

/** pLDDT 0–100 → the four AlphaFold confidence bands (<50, 50–70, 70–90, ≥90) */
export function plddtColor(v: number): RGB {
	return plddtMap(v);
}

/** RSA 0–100 % → deep blue (buried) to white (exposed) */
export function rsaColor(v: number): RGB {
	return rsaMap(v / 100);
}

/** Gap ratio 0–1 → dark blue (no gaps, high confidence) to red (mostly gaps) */
export function gapRatioColor(v: number): RGB {
	return gapRatioMap(v);
}
