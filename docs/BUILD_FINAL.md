# Build the final Shoebox frontend

Read `CLAUDE.md` and `docs/FRONTEND_BRIEF.md` §0–§1 first. The visual and interaction source of truth is `docs/reference/ShoeboxFinal.dc.html` (a design-tool prototype: inline styles are exact values, the `<script>` holds the interaction logic; port it to React — don't copy its `{{…}}`, `<sc-if>`, `<sc-for>` syntax).

It combines three of the versions Robert liked plus the research-backed review flow. Reuse their real code instead of rebuilding:

| Part of the final design | Reuse from | What Robert liked |
| --- | --- | --- |
| Monthly spending: stacked bars per month, selected month saturated and outlined, others tinted, dashed pace box for the current month, connector into a day-by-day bar chart, "Biggest day …" | branch `fe/insights-v4-spine` (worktree `C:/Users/Robert/ktp-v4`) | "the bars came out really nicely" |
| Answer-first headline ("You've spent $X in November so far.") with mini 6-month bars | branch `fe/insights-v5-answer` (worktree `C:/Users/Robert/ktp-v5`) | the sentences, "7 days into November, you've spent 21% of October's total" |
| Findings grid, always open (NO collapsible rows): Where it went, Top merchants, By day of the week, A typical receipt — 2×2 cards like v4's layout, but each card's title is v5's answer sentence ("Groceries is 52% of it so far, then …"). Clicks do real work: category row → focus the page on it; merchant row (current month) → Receipts tab searched to that merchant; weekday bar → highlight those days in the day-by-day chart | v4 card layout + v5 sentences | Robert dislikes dropdowns that hide content |
| Command bar: month stepper, merchant search with `/`, keyboard hints, category chip row; keyboard ← → month, 1–8 category, 0/Esc clear, `/` focuses search | branch `fe/insights-v6-command` (worktree `C:/Users/Robert/ktp-v6`) | "the cool tab at the top", keys, search |
| "Needs a look" strip, review queue (1 of 3, image left with the uncertain line outlined, only the flagged field editable, live "✓ items and tax match", Confirm and next → "All caught up"), learned-category message, Add receipts sheet with Take a photo / Choose files, "Reading receipt…" row | `docs/reference/ShoeboxFinal.dc.html` | research-backed core flow |

Use `git show <branch>:<path>` or read the worktree folders to lift components. Build on a new branch `fe/final` from `fe/insights-dashboard`.

## Screens and scope (checked against the team's Drive notes)

- **Insights** (default after login): command bar → hero sentence + mini month bars → "N receipts need a look" strip → Monthly spending chart with day drill-down → four always-open finding cards → 2026 discounts/tax line. A category chip or category row focuses the whole page (hero amount, chart highlight, merchants).
- **Receipts** (tab with a count badge): Needs a look / Filed / All tabs, search by merchant or item, date-grouped rows, "Export for accountant" button disabled with "soon" (Aiden owns export).
- **Review** (full-screen, from the strip, a row, or the badge) — the most important screen.
- **Add receipts** sheet: drag-and-drop on desktop; `<input type="file" accept="image/*,.pdf" capture="environment">` so phones open the camera; processing row while the backend reads it.
- **Sign in / Register**: one calm card, same tokens (see the prototype's sign-out flow).
- **Account menu** (avatar button, top right): popover showing "Signed in as <email>" from `GET /api/auth/me`, Keyboard shortcuts (opens a list; `?` also opens it), Sign out (`POST /api/auth/logout` → sign-in screen), and the one-line privacy note. Closes on Esc or click outside. No settings the backend can't save (no password change, no profile edits).
- Not in this build (no backend yet): bills/due dates/reminders, subscriptions, budgets, CSV export.

All numbers come from the real API (§1). Demo data: `backend/scripts/seed_demo.py` (food truck). Compute pace and "same days last month" comparisons client-side.

## Order (one slice per commit)

1. Tokens + fonts + shell (top bar with Insights/Receipts tabs and badge, Add receipts, account button). Delete the empty `backend/app/insight_routes.py`.
2. Command bar + keyboard shortcuts + category filter state (shared across the page).
3. Hero + mini month bars + needs-a-look strip.
4. Monthly spending chart with day drill-down (port from v4).
5. Finding cards, always open (layout from v4, sentence titles from v5), with the click actions above.
6. Receipts tab.
7. Review flow + learned-category message.
8. Add receipts + processing row.
9. Sign in / Register + account menu.
10. Motion pass (CLAUDE.md § Motion) + reduced motion.
11. One critique pass: `npx impeccable detect`, then `/impeccable critique` on Insights and Review only; fix real issues.

After each slice: `npm run lint`, `npm run build`, then one Playwright screenshot at 1440 wide (390 wide only for slices 3, 6, 7, 9). Look at it before moving on.

## Keep usage low

- One session, one branch. No more parallel variants or worktrees.
- Don't run Impeccable until slice 11. Screenshot only what the slice changed.
- Run `/compact` between slices. If context resets, read `git log --oneline fe/final` and continue from the next slice.
- Stop and ask Robert only for: a backend change, a dependency outside CLAUDE.md's list, or a visual decision the prototype doesn't answer.
