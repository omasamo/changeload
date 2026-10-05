# ChangeLoad prototype

Live demo: https://omasamo.github.io/changeload/ (GitHub Pages, from https://github.com/omasamo/changeload). Artifact copy: https://claude.ai/artifact/JUJ6xfnS6Y88LXsCH4yFy8 (private until shared)

- `changeload.html` is the built, self-contained page. Rebuild it with `python3 build.py` after editing `src/`.
- `src/engine.js` holds the scoring (product-definition.md sections 4 and 5), `src/seed.js` the Halden Group demo data, `src/app.js` the UI.
- Data lives in the viewer's browser. Settings > Reset demo data restores the starting scenario.

## Guided demo
Click **Guided demo** in the left rail (or "Take the 2-minute tour" in the banner). Eight steps walk a manager or investor through the story with Next and Back (arrow keys work too). The bar docks at the bottom of the screen so it never covers the panel it is talking about. Each step replays from the original demo data, so it always shows the same screens. **Day / Night / Auto** under Display switches the colour theme; the choice is remembered in the browser.

## Layout
The portfolio reads top to bottom in the order a manager asks the questions: how bad is it (four figures), where and when (the heatmap, with the selected cell explained in the panel on the right), and what to do (the banner and the pre-approval check). The heatmap sizes its cells to the window so all 26 weeks fit on a laptop; when they cannot, a fade at the right edge shows there is more to scroll. In the initiative editor the portfolio check is a sticky panel that follows the form. On a phone the five views move to a tab bar at the bottom and the figures come before the story.

## Tests
`node --test tests/engine.test.js` checks the scoring engine and the demo story (Critical in November, 11-week suggested slot, €160k cost of overload that drops to zero). The Pages workflow runs it before every deploy.

## 5-minute demo script (manual)
1. Portfolio: Service Desk and Client Operations hit Critical in the weeks of 16 and 23 Nov. Click a dark cell to show which initiatives drive it.
2. Point at **Cost of overload**: about €160k of change work above capacity in the next 26 weeks.
3. Click "Open Ticket management to cloud" in the banner. The portfolio check shows it pushes both groups into Critical, adds the €160k, and suggests starting 11 weeks later (go-live 1 Feb 2027).
4. Apply suggested slot, Save. The heatmap drops to Amber at worst and the cost of overload to €0.
5. Groups > Service Desk: stacked load by initiative against the 70/100/130 lines.
6. Initiatives > New from example: an all-staff e-learning shows the "already overwhelmed" warning.

## Screenshots (screenshots/)
01 portfolio heatmap, 02 pre-approval check (02b panel only), 03 suggested slot applied, 04 portfolio after the fix, 05 Service Desk group view, 06 weekly digest, 07 initiative register, 08 settings, 09 night mode, 10 phone, 11 guided demo.

## GitHub Pages
The whole folder is a ready repository. `.github/workflows/pages.yml` runs `build.py` on every push to `main` and publishes `site/` (a standalone `index.html` with no backend and no asset paths, so it works from any Pages subpath). In the repository, set Settings > Pages > Source to "GitHub Actions" once.
