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
	fields: [],
	description:
		'SNPMuSiC assesses the disease-causing potential of missense single nucleotide polymorphisms (SNPs) by evaluating their impact on protein structure and stability. It combines structural features and evolutionary information to discriminate pathogenic from neutral variants.',
	tags: ['SNP', 'pathogenicity', 'missense variants', 'disease prediction'],
	doi: '10.1093/bioinformatics/btu481',
	bibTeX: `@article{Raimondi2013,
  author  = {Raimondi, Daniele and Tanyalcin, Ibrahim and Ferté, Julien and Gilis, Dimitri and Rooman, Marianne},
  title   = {DEOGEN2: prediction and interactive visualisation of single amino acid variant deleteriousness in human proteins},
  journal = {Nucleic Acids Research},
  year    = {2017},
  volume  = {45},
  number  = {W1},
  pages   = {W201--W206},
  doi     = {10.1093/nar/gkx390}
}`,
	logoPath: '/logos/snpmusic.svg'
};
