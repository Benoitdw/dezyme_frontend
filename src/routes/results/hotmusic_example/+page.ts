import { base } from '$app/paths';
import { parseHotFile, parseHotsFile } from '$lib/utils/hotmusic';
import { parsePdbFile } from '$lib/utils/pdb';

export async function load({ fetch }) {
	const prefix = `${base}/examples/hotmusic`;

	const [hotsText, hotText, pdbText, logText] = await Promise.all([
		fetch(`${prefix}/query_47691.hots`).then((r) => r.text()),
		fetch(`${prefix}/query_47691.hot`).then((r) => r.text()),
		fetch(`${prefix}/3BIO.pdb`).then((r) => r.text()),
		fetch(`${prefix}/query_47691.log`).then((r) => (r.ok ? r.text() : null)).catch(() => null),
	]);

	return {
		summary:    parseHotsFile(hotsText),
		mutations:  parseHotFile(hotText),
		meta:       parsePdbFile(pdbText, '3BIO.pdb'),
		pdbUrl:     `${prefix}/3BIO.pdb`,
		downloadUrls: {
			hot:  `${prefix}/query_47691.hot`,
			hots: `${prefix}/query_47691.hots`,
			pdb:  `${prefix}/3BIO.pdb`,
		},
		logContent: logText,
	};
}
