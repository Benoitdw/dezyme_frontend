import type { ToolConfig } from './types';

export const snpmusic: ToolConfig = {
	id: 'snpmusic',
	name: 'SNPMuSiC',
	tagline: 'Predict the pathogenicity of single nucleotide polymorphisms',
	accent: '#10b981',
	chainRule: {
		preselect: (chains) => chains,
		multiple: true
	},
	fields: []
};
