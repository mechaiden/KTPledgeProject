# Frontend brief — weekend of Nov 7–8, 2026

Goal: by Sunday night, a frontend that looks designed rather than generated, built on the existing branch `fe/insights-dashboard`, with one user flow proven end to end by an automated test.

---

## 0. Product fit (from the team's planning docs: 10/6, 10/18, 11/3, Final Notes)

**Name:** Shoebox — "We replace the shoebox." Replaces the shoebox of paper receipts small businesses keep for taxes.
**Who:** small business owners and self-employed people without a bookkeeper (food trucks, salons, contractors). Thin margins, no time, not finance experts. NOT students.
**Promise:** snap a receipt, get organized spending data, only step in when you need to.
**What makes it different (show these in the UI, they're real backend features):**
1. **It checks itself.** Receipts it isn't sure about go to "Needs review" with a plain-English reason (no total, unreadable price, items don't add up). The review queue is the heart of the app, not a side tab.
2. **It learns from corrections.** Changing a receipt's category makes future receipts from that merchant use it. After a category change, say so: "Got it. Future Restaurant Depot receipts will go to Groceries."
3. **It groups store spellings.** "CHIPOTLE #1234" and "Chipotle" are one merchant — show the clean name.
4. **It reads receipts locally.** Privacy is a selling point: "Your receipts are read on our server by our own model, not sent to a third-party AI." (Confirm exact wording with Aiden before shipping.)
5. **It survives restarts.** Receipts stuck processing get flagged for review — the UI should never show an eternal spinner.

**Voice:** a calm, competent bookkeeper. Plain words, specific numbers, no hype, no finance jargon. "3 receipts need a quick look", "Ready for your accountant", never "Supercharge your finances". The design should feel like a trustworthy professional tool — restrained, precise — not a consumer toy and not a themed costume.

**Scope status** (frontend this weekend = ✅ build, 🟡 build UI only if the endpoint lands, ⬜ later):
| Feature (source) | Backend today | Frontend |
| --- | --- | --- |
| Sign up / log in (10/18) | ✅ | ✅ restyle |
| Upload photo or PDF (10/18) | ✅ JPG/PNG/PDF | ✅ + `accept="image/*,.pdf"` and `capture="environment"` so phones open the camera |
| Auto-extract + categorize (10/18) | ✅ | ✅ |
| Review screen with reasons (10/18, Final) | ✅ | ✅ the core flow |
| Learns from category corrections (Final) | ✅ | ✅ confirmation message |
| Spending insights: categories, trend, merchants, weekday, receipt size, savings/tax (11/3) | ✅ six endpoints | ✅ |
| Spending pace (11/3) | computed client-side | ✅ |
| CSV export for accountant (10/18, Aiden's list) | ⬜ planned | 🟡 "Export for accountant" button; hide if no endpoint |
| Add receipt by hand (Aiden's list) | ⬜ planned | 🟡 reuse the editor with empty fields |
| Search + filters (Aiden's list) | ⬜ planned | ✅ client-side search/filter on the loaded list |
| Duplicate warning, Read again button, HEIC (Aiden's list) | ⬜ planned | 🟡 |
| Bills due / overdue / paid, reminders (10/18) | ⬜ no due dates in schema | ⬜ — needs a team decision |
| Recurring charges + cancel flags (10/18), recurring merchants, unusual spending, frequency habits (11/3) | ⬜ | ⬜ next |
| Budgets per category (11/3) | ⬜ needs a table | ⬜ out of scope |

**Open question for Aiden:** the 8 categories (Dining, Groceries, Shopping…) are consumer categories; a food truck's "Groceries" is really inventory/supplies. Don't change them in the frontend — raise it with the team.

**Demo data** must look like a small business (e.g. a food truck: Restaurant Depot, Sysco, Costco Business Center, Shell, Home Depot, Office Depot), not a student's spending. The prototype's sample merchants are placeholders; its layout and interactions are the reference, its copy should be adapted to this audience.
Design system and rules: `CLAUDE.md`. This file says WHAT to build and in what order.

Starting point: the branch already has a working `InsightsPage.jsx` wired to all six insights endpoints, a Receipts/Insights top nav, and a month-to-date pace line. Its logic is good; its look is the old cream/serif/green default. Keep the data logic, replace the presentation.

---

## 1. API contract (all under `/api`, cookie auth, JSON in camelCase)

Auth
- `POST /auth/register` `{email, password(8–128)}` → `UserOut` (201; sets cookie)
- `POST /auth/login` `{email, password}` → `UserOut` · 401 "Invalid email or password"
- `POST /auth/logout` → 204 · `GET /auth/me` → `UserOut` or 401

Receipts
- `GET /receipts` → `ReceiptOut[]`, newest date first
- `POST /receipts` multipart field `file` (JPG/PNG/PDF ≤ 10 MB) → `ReceiptOut` 201 with `status:"processing"`; 415/413 errors with a `detail` message. Processing runs in the background — poll `GET /receipts` (existing code polls every 3 s).
- `GET /receipts/{id}` → `ReceiptOut` · `GET /receipts/{id}/image` → the file
- `PATCH /receipts/{id}` body `{merchant, date, category?, subtotal?, discount?, tax?, total, items[{name, qty?, total?}]}` → `ReceiptOut`, sets `status:"done"`. 409 while processing.
- `DELETE /receipts/{id}` → 204
- `ReceiptOut` = `{id, status: "processing"|"review"|"done", reviewReason, date, merchant, category, subtotal, discount, tax, total, items[], imageUrl}`
- `GET /categories` → the 8 category names

Insights (`month` = "YYYY-MM", sent from the browser's clock)
- `GET /insights/categories?month=` → `[{category, total, prevTotal, change}]` (current vs previous month)
- `GET /insights/trend?month=&months=6` → `[{month, total, byCategory:{cat: amount}}]`
- `GET /insights/merchants?month=&limit=5` → `[{merchantKey, name, visits, total, avgPerVisit}]`
- `GET /insights/weekdays?month=` → `[{weekday, total, visits}]` Monday first
- `GET /insights/receipt-size?month=` → `[{category, count, average, median}]`
- `GET /insights/savings?year=` → `{discountTotal, taxTotal, receiptCount}`
- Stats exclude receipts still processing or missing a date/total.

## 2. Visual references — what to take from each

1. **The final prototype** — `docs/reference/ShoeboxFinal.dc.html` (it supersedes the older `Prototype.dc.html`, kept only for history). THIS IS THE SOURCE OF TRUTH for layout, copy, colors, spacing and interactions. Read its markup (inline styles = exact values) and its script (the interaction logic). Port it to React components; don't copy its template syntax (`{{…}}`, `<sc-if>`, `<sc-for>` are the design tool's, not React). Key behaviors to reproduce:
   - Hero "receipt" card with torn bottom edge: month total, pace line for the current month ("Day 7 of 30 · on pace for $X"), two pace bars, and 1–2 computed plain-English insight sentences.
   - Peach "N receipts need a quick look" strip with one chip per receipt that opens the editor directly.
   - Clicking a category focuses the whole page on it: highlights it in the trend chart, filters top merchants, shows "Show all".
   - Clicking a month in the trend chart switches the month; the current month shows a dashed "projected" outline.
   - Receipts view: date-grouped list (Today / Yesterday / weekday), segmented tabs All / Needs a look / Done with counts.
   - Editor: the scanned receipt on the left with the uncertain line highlighted; fields on the right; only the flagged field is editable and highlighted; live check "✓ Items + tax match the total" / "Off by $X"; Save disabled until it matches; toast "Saved. 2 left to review."
   - Add receipt: a processing card with a printing-receipt animation, then the receipt prints into the list and lands in Needs a look.
   - Delete shows a toast with Undo.
2. **Copilot Money** (Apple Design Award finalist): color only for data, neutral chrome; summary first, detail one click away; each category always the same color.
3. **Real thermal receipts**: monospaced numbers right-aligned in columns, dashed dividers, the torn bottom edge. Borrow the texture, not a skeuomorphic costume. One perforated edge, no paper texture images.

## 3. The one user flow that must work perfectly

1. Sign in as the demo user.
2. Land on **Insights** (make it the default view once logged in). See the month total, change vs last month, and the insight sentence within one glance.
3. Switch months with ← → (keyboard arrows also work). Numbers and bars update without the layout jumping.
4. See "3 receipts need a look" → click **Review**.
5. Receipts view opens filtered to Review. Click a receipt → the editor opens with the image on the left and the flagged field highlighted with the reason.
6. Fix the total → **Save**. Toast: "Saved. 2 left to review." The row leaves the list; the count updates everywhere.
7. Drag in a receipt image (or click **Add receipts**) → a processing card appears at the top → when processing ends it becomes a row (locally it will land in Review — that's fine).

## 4. Screens and layout requirements

Breakpoints to check: **1440, 768, 390** px wide.

- **Shell**: top bar (wordmark, Insights / Receipts nav with a review-count badge, Add receipts button, account menu). Content max-width 1120px centered. Under 640px the nav moves into a bottom tab bar; Add receipts becomes a floating button.
- **Insights**: total card full width; then a 2-column grid at ≥ 1024px (categories | trend, merchants | weekday + savings + review card), 1 column below. No card taller than its content; no dead space.
- **Receipts**: month bar, All / Needs review tabs with counts, a table on desktop (date, merchant, category chip, total right-aligned in mono, status), stacked cards on mobile. Clicking a row opens the editor. Drag-and-drop anywhere shows a full-page drop target.
- **Editor**: modal ≤ 1040px wide. Image pane fixed at 400px (scroll/zoom inside it), fields fill the rest — this fixes the current huge gap on wide screens. Line items as an editable table with live subtotal math; a mismatch shows inline. Full-screen sheet on mobile with the image collapsible at top.
- **Sign in / Register**: one centered card, max 380px, wordmark + one-line value statement ("Snap a receipt. See where your money goes."), email, password, submit, switch link.

## 5. States (every screen) and the three animations

States
- **Loading**: skeletons shaped like the final content, shown only if loading takes > 300ms (no flash). Never a full-page spinner.
- **Empty**: no receipts at all → Insights shows one card: "No receipts yet" + Add receipts button + a dashed drop zone. Month with no data → "Nothing recorded in October" with a link to the latest month that has data.
- **Error**: inline message in the card that failed + Retry. Network down on save → the editor keeps the edits and shows the error by the Save button.
- **Success**: toast bottom-center, 3 s, for save/delete/upload; Undo on delete.
- **Processing**: a card with the filename, a thin indeterminate progress line, and "Reading receipt…".

Animations (the only ones)
1. **Receipt prints in**: the processing card morphs into its finished row via `layoutId` when processing ends (row slides down into place, 250ms).
2. **Bars re-settle** on month change: category bars animate `scaleX` from the old value to the new (200ms); numbers do not count up.
3. **Review clears**: a fixed receipt's row collapses out (height + opacity, 200ms) and the badge count ticks.

## 6. The executable check

Add `@playwright/test` as a dev dependency and `frontend/e2e/flow.spec.js` that:
- runs the seed script for `e2e@ktp.dev` (fresh data each run),
- logs in, asserts the Insights total is visible and matches the sum of done receipts for the month,
- opens Review, fixes one receipt's total, saves, asserts the count dropped by one,
- uploads `test_images/sample_receipt_clean.png`, asserts a processing card appears,
- saves full-page screenshots of Insights, Receipts and the editor at 1440, 768 and 390 to `frontend/e2e/screenshots/` (gitignored).
Add `"test:e2e": "playwright test"` to `package.json`. The suite must pass before each commit from slice 2 on.

## 7. Build order — one slice at a time

For each slice: implement → run → screenshot (Playwright MCP) and look → fix → lint + build + e2e → commit.

0. **Setup**: delete `backend/app/insight_routes.py`; run the seed script; install `motion`, `lucide-react`, fonts; put all tokens in `:root`; restyle the shell (top bar, nav, content width). Commit.
1. **Insights** restyled to the Thermal reference, including empty/loading/error states. Commit.
2. **E2E harness** (§6) with the Insights assertions. Commit.
3. **Receipts list** + tabs + mobile cards. Commit.
4. **Editor** with the layout fix and inline validation; finish the flow assertions. Commit.
5. **Upload + processing card** + drop target. Commit.
6. **Sign in / Register**. Commit.
7. **The three animations** + reduced-motion fallbacks. Commit.
8. **Critique**: `npx impeccable detect`, then `/impeccable critique` on Insights and the editor; fix what's real; re-run e2e. Commit.
9. **README**: a Setup section (Windows + macOS commands, `.env`, seed script, Dolphin optional). Commit.

Stop and ask Robert only if: a slice needs a backend change, a new dependency outside the allowed list, or a design decision this brief and CLAUDE.md don't cover.

## Out of scope this weekend

Bills/due dates/reminders, recurring-charge detection, budgets, notifications, dark mode, multi-user sharing, deploying, installing Dolphin. (See §0 for what's next.)
