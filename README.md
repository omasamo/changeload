# ChangeLoad prototype

Live demo: https://claude.ai/artifact/JUJ6xfnS6Y88LXsCH4yFy8 (private until shared from the page's Share menu)

- `changeload.html` is the built, self-contained page. Rebuild it with `python3 build.py` after editing `src/`.
- `src/engine.js` holds the scoring (product-definition.md sections 4 and 5), `src/seed.js` the Halden Group demo data, `src/app.js` the UI.
- Data lives in the viewer's browser. Settings > Reset demo data restores the starting scenario.

## 5-minute demo script
1. Portfolio: Service Desk and Client Operations hit Critical in the weeks of 16 and 23 Nov. Click a dark cell to show which initiatives drive it.
2. Click "Open Ticket management to cloud" in the banner. The portfolio check shows it pushes both groups into Critical and suggests starting 11 weeks later (go-live 1 Feb 2027).
3. Apply suggested slot, Save. The heatmap drops to Amber at worst.
4. Groups > Service Desk: stacked load by initiative against the 70/100/130 lines.
5. Initiatives > New from example: an all-staff e-learning shows the "already overwhelmed" warning.

## Screenshots (screenshots/)
01 portfolio heatmap, 02 pre-approval check (02b panel only), 03 suggested slot applied, 04 portfolio after the fix, 05 Service Desk group view, 06 weekly digest, 07 initiative register, 08 settings, 09 dark theme, 10 phone.

## GitHub Pages
The whole folder is a ready repository. `.github/workflows/pages.yml` runs `build.py` on every push to `main` and publishes `site/` (a standalone `index.html` with no backend and no asset paths, so it works from any Pages subpath). In the repository, set Settings > Pages > Source to "GitHub Actions" once.
