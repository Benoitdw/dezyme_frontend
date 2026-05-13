# Dezyme — Frontend Design

## Overview

SvelteKit frontend for three protein mutation analysis tools (PopMuSiC, HoTMuSiC, SNPMuSiC). Backend API TBD — fake/mock data used during development.

---

## Routing

| Route | Description |
|---|---|
| `/` | Landing page |
| `/run?tool=popmusic` | Dynamic form (tool pre-selected via query param) |
| `/results/[analysis_id]` | Job tracking + results visualization |

`analysis_id` is prefixed with the tool name (e.g. `popmusic_abc123`) so the results page knows which viewer to load without extra params.

---

## Project Structure

```
src/
  routes/
    +page.svelte                      # landing
    run/+page.svelte                  # form
    results/[id]/+page.svelte         # results
  lib/
    components/
      pdb/
        PdbInput.svelte               # text input (autodetect) + drag & drop upload
        PdbMetadata.svelte            # dynamic metadata display after fetch
        ChainSelector.svelte          # chain selection with injected chainRule
      form/
        ToolSelector.svelte           # tabs: PopMuSiC / HoTMuSiC / SNPMuSiC
        SubmitButton.svelte
      results/
        JobTracker.svelte             # polling + status display
        PopMuSiCViewer.svelte
        HoTMuSiCViewer.svelte
        SNPMuSiCViewer.svelte
    tools/
      popmusic.ts                     # form config + chainRule
      hotmusic.ts
      snpmusic.ts
      types.ts                        # Tool, FormConfig, ChainRule interfaces
    utils/
      pdb.ts                          # PDB parsing, metadata extraction, autodetect
      api.ts                          # backend calls (fake for now)
      storage.ts                      # localStorage: recent analysis IDs
```

---

## Visual Design

- **Dark mode by default**, light/dark toggle persisting in localStorage
- Smooth CSS transition between modes via custom properties on `:root`
- Dark palette: bg `#0f1117`, cards `#1a1d27`, one distinct accent color per tool
- Light palette: bg `#f8f9fc`, white cards, same accents
- No terminal vibe — clean scientific SaaS aesthetic

---

## Landing Page `/`

- Navbar: logo + theme toggle
- Hero: short tagline ("Protein mutation analysis tools")
- Three tool cards (PopMuSiC, HoTMuSiC, SNPMuSiC) with description + Launch button → `/run?tool=<name>`
- Recent analyses section (only shown if localStorage has entries)

---

## Form Page `/run`

- Tool tabs at top, pre-selected from `?tool=` query param
- Switching tool tabs **preserves the loaded PDB** and only re-applies chain pre-selection rules
- PDB widget states: `idle → loading → loaded | error`

### Structure Input

Single text field with keystroke autodetect:
- 4 alphanumeric chars → PDB ID → RCSB API
- UniProt format (`P12345`) → AlphaFold API
- Dynamic label under field shows detected type before fetching

Plus a drag & drop zone with Browse button for direct PDB file upload.

### After PDB Load

- `PdbMetadata` displays: name, chains, resolution, organism
- `ChainSelector` renders chain buttons with tool-specific pre-selection rules
- Tool-specific fields render below

### Submit

→ `api.ts POST /analyze` → `{ analysis_id: "popmusic_abc123" }`
→ save ID to localStorage
→ redirect to `/results/popmusic_abc123`

---

## Results Page `/results/[id]`

Parse tool prefix from ID → load correct `ResultsViewer` dynamically:
```ts
const viewer = await import(`$lib/components/results/${tool}Viewer.svelte`)
```

### Job In Progress

- Spinner + raw status from backend (`pending` / `running`)
- Job params summary (structure, chains, tool)
- Copy ID + Share link buttons

### Job Done

- Status replaced by tool-specific `ResultsViewer`
- Smooth transition, no page reload
- Export + New analysis buttons

> No timestamp shown — backend status only. No localStorage timestamp stored.
> Revisit when backend design is finalized.

---

## State & Storage

```ts
// src/lib/stores/jobs.ts
recentJobs: [{ id, tool, status }]  // synced to localStorage
```

Displayed on landing page as "recent analyses" shortcut.

---

## Fake API (development)

`api.ts` returns hardcoded data with simulated delay (`setTimeout`). Easily swappable for real calls. Result data injected via local files provided per tool.
