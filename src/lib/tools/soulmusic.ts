import type { ToolConfig } from './types';

export const soulmusic: ToolConfig = {
	id: 'soulmusic',
	name: 'SoulMuSiC',
	tagline: 'Predict the impact of mutations on protein solubility and aggregation propensity',
	accent: '#8898b8',
	chainRule: {
		preselect: (chains) => chains.slice(0, 1),
		multiple: false
	},
	fields: [],
	description:
		'SoulMuSiC predicts changes in protein solubility and aggregation propensity caused by single amino acid mutations. It integrates structural and sequence features to assess whether a mutation promotes or suppresses aggregation under physiological conditions.',
	tags: ['solubility', 'aggregation', 'single mutations', 'structural features'],
	comingSoon: true
};
