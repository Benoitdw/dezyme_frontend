# Dezyme

A SvelteKit frontend for protein mutation analysis tools: **PopMuSiC**, **HoTMuSiC**, and **SNPMuSiC**.

## Developing

```sh
npm install
npm run dev
```

## Building

```sh
npm run build
npm run preview
```

## Docker

```sh
docker compose up --build
```

---

## Credits

3D protein visualisation powered by [LittleProtein](https://github.com/MatsveiTsishyn/LittleProtein) by Matsvei Tsishyn.

---

## Editing soft ID cards

Each tool displays a **soft ID card** on the run page showing its description, tags, DOI, and a button to copy the BibTeX reference. All card content is defined alongside the tool configuration.

### Where to edit

Each tool lives in its own file under `src/lib/tools/`:

| Tool | File |
|------|------|
| PopMuSiC | `src/lib/tools/popmusic.ts` |
| HoTMuSiC | `src/lib/tools/hotmusic.ts` |
| SNPMuSiC | `src/lib/tools/snpmusic.ts` |

### Available fields

```ts
{
  // Card content
  description?: string;   // One or two sentences shown in the card body
  tags?: string[];        // Short keyword labels (displayed as colored pills)
  doi?: string;           // DOI string only, without "https://doi.org/" prefix
  bibTeX?: string;        // Full BibTeX entry — copied to clipboard by the button
  logoPath?: string;      // Path relative to /static/, e.g. "/logos/popmusic.svg"
}
```

### Adding / replacing a logo

Place the image file (SVG recommended, PNG/JPEG accepted) in `static/logos/` and set `logoPath` accordingly:

```ts
logoPath: '/logos/popmusic.svg'
```

If `logoPath` is omitted or the file is missing, a generic placeholder is shown automatically (`static/logos/default.svg`).

### Example

```ts
// src/lib/tools/popmusic.ts
export const popmusic: ToolConfig = {
  id: 'popmusic',
  name: 'PopMuSiC',
  tagline: 'Predict the thermodynamic stability changes induced by single-site mutations',
  accent: '#6366f1',
  chainRule: { preselect: (chains) => chains.slice(0, 1), multiple: false },
  fields: [],

  description: 'PopMuSiC predicts ΔΔG upon single amino acid substitutions …',
  tags: ['thermodynamic stability', 'ΔΔG', 'single mutations'],
  doi: '10.1093/nar/gkr353',
  bibTeX: `@article{Dehouck2011, … }`,
  logoPath: '/logos/popmusic.svg'
};
```

### Card component

The component itself is at `src/lib/components/SoftIdCard.svelte`. It receives a single `tool` prop of type `ToolConfig`.
