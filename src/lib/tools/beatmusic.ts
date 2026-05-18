import type { ToolConfig } from './types';

export const beatmusic: ToolConfig = {
	id: 'beatmusic',
	name: 'BeAtMuSiC',
	tagline: 'Evaluate binding affinity changes at protein-protein interfaces upon single-site mutations',
	accent: '#0e7490',
	chainRule: {
		preselect: (chains) => chains.slice(0, 1),
		multiple: true
	},
	fields: [],
	description:
		'BeAtMuSiC evaluates the change in binding affinity between proteins caused by single-site mutations in their sequence. Predictions are based on the structure of the protein-protein complex and can target manually specified mutations, a systematic scan of all possible mutations in a chain, or mutations at the protein-protein interface.',
	tags: ['binding affinity', 'ΔΔG binding', 'protein-protein interaction', 'interface mutations'],
	doi: '10.1093/nar/gkt450',
	bibTeX: `@article{Dehouck2013,
  author  = {Dehouck, Yves and Kwasigroch, Jean Marc and Rooman, Marianne and Gilis, Dimitri},
  title   = {BeAtMuSiC: prediction of changes in protein-protein binding affinity on mutations},
  journal = {Nucleic Acids Research},
  year    = {2013},
  volume  = {41},
  number  = {W1},
  pages   = {W333--W339},
  doi     = {10.1093/nar/gkt450}
}`,
	comingSoon: true,
	legacyUrl: 'http://babylone.3bio.ulb.ac.be/beatmusic/'
};
