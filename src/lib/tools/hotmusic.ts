import type { ToolConfig } from './types';

export const hotmusic: ToolConfig = {
	id: 'hotmusic',
	name: 'HoTMuSiC',
	tagline: 'Predict the effects of mutations on protein thermal stability',
	accent: '#f59e0b',
	chainRule: {
		preselect: (chains) => chains.slice(0, 1),
		multiple: false
	},
	mutationList: true,
	fields: [
		{
			name: 'tm_wt',
			label: 'Melting temperature of the wild type protein',
			type: 'number',
			placeholder: 'unknown',
			unit: 'K',
			min: 273.0,
			max: 413.0,
			step: 0.1,
			hint: 'Leave empty if unknown.'
		}
	],
	description:
		'HoTMuSiC predicts the change in melting temperature (ΔTm) caused by single-site mutations in proteins. It relies on statistical potentials derived from thermophilic and mesophilic protein structures and experimental stability data.',
	tags: ['thermal stability', 'ΔTm', 'melting temperature', 'single mutations'],
	doi: '10.1093/bioinformatics/btv595',
	bibTeX: `@article{Pucci2016,
  author  = {Pucci, Fabrizio and Bourgeas, Romain and Rooman, Marianne},
  title   = {Predicting protein thermal stability changes upon point mutations using statistical potentials: Introducing HoTMuSiC},
  journal = {Scientific Reports},
  year    = {2016},
  volume  = {6},
  pages   = {23257},
  doi     = {10.1038/srep23257}
}`,
	logoPath: '/logos/hotmusic.svg'
};
