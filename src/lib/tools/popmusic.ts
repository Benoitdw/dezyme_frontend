import type { ToolConfig } from './types';

export const popmusic: ToolConfig = {
	id: 'popmusic',
	name: 'PopMuSiC',
	tagline: 'Predict the thermodynamic stability changes induced by single-site mutations',
	accent: '#6366f1',
	chainRule: {
		preselect: (chains) => chains.slice(0, 1),
		multiple: false
	},
	fields: [],
	requiresMsa: true,
	multipleMutations: true,
	description:
		'PopMuSiC predicts the thermodynamic stability change (ΔΔG) upon single amino acid substitutions in proteins. It uses a combination of statistical potentials and machine learning trained on a large dataset of experimental measurements.',
	tags: ['thermodynamic stability', 'ΔΔG', 'single mutations', 'machine learning'],
	doi: '10.1093/bioinformatics/btp445',
	bibTeX: `@article{Dehouck2011,
  author  = {Dehouck, Yves and Kwasigroch, Jean Marc and Gilis, Dimitri and Rooman, Marianne},
  title   = {PoPMuSiC 2.1: a web server for the estimation of protein stability changes upon mutation},
  journal = {Nucleic Acids Research},
  year    = {2011},
  volume  = {39},
  number  = {suppl_2},
  pages   = {W448--W455},
  doi     = {10.1093/nar/gkr353}
}`,
	logoPath: '/logos/popmusic.png'
};
