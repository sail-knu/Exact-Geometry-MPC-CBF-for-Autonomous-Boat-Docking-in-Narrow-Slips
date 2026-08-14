# Exact-Geometry MPC-CBF for Autonomous Boat Docking in Narrow Slips

Project page: an interactive **feasible-centre corridor** (how heading and
footprint geometry change where the vessel may sit) and synchronized
closed-loop videos for scenarios **S1–S5**.

## Live page

Enable **GitHub Pages** on this repository (Settings → Pages → Deploy from
branch `main` / `/ (root)`). The site root is this folder.

Local preview:

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Contents

| Path | Description |
|------|-------------|
| `index.html` / `app.js` / `styles.css` | Interactive project page |
| `data/fig3.json` | Precomputed feasible-centre contours (every 3°) |
| `data/sweep.json` | Narrow-slip sweep success rates (1800 runs) |
| `videos/` | Review videos: 5 scenarios × 6 controllers |

## Regenerate Fig.&nbsp;3 data

From the research codebase (`python_code/`):

```bash
python scripts/export_project_page_fig3.py
```

## Controllers compared

circle · ellipse · 3-disc · 6-disc · polygon DC · proposed (polygon CBF)
