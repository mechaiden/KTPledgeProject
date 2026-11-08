# Shoebox — "We replace the shoebox"

Small business owners and freelancers without a bookkeeper (food trucks, salons, contractors) snap or upload receipts; a local AI model reads them, files each into a category, flags anything it isn't sure about, and turns the pile into organized spending data they can hand to an accountant.
The promise: **snap a receipt, get organized, only step in when you need to.** Every screen should serve that. Product fit, scope and copy voice: `docs/FRONTEND_BRIEF.md` §0.
Robert owns the frontend. Aiden owns the backend. Current frontend work and its plan live in `docs/FRONTEND_BRIEF.md` — read it before any frontend task.

## Run it (Windows, PowerShell or Git Bash)

- Backend (from `backend/`): `venv/Scripts/python -m uvicorn app.main:app --reload` → http://localhost:8000
- Frontend (from `frontend/`): `npm run dev` → http://localhost:5173 (Vite proxies `/api` to :8000)
- Demo data (from `backend/`): `venv/Scripts/python scripts/seed_demo.py --email demo@ktp.dev` (password `demo-pass-123`)
- Lint: `npm run lint` · Build: `npm run build` · Backend tests: `venv/Scripts/python -m pytest`
- The OCR model (Dolphin) is NOT installed locally. Uploads land in "review" instead of auto-filling. That's expected; design for it.

## Architecture

- `frontend/` React 19 + Vite 8, plain CSS in `src/styles.css`, no router (view in URL hash: `#receipts`, `#insights`), no UI library.
- `frontend/src/api.js` is the only way to call the backend (cookies, JSON, error → `Error`).
- `backend/` FastAPI + SQLAlchemy + SQLite. JSON is camelCase (`reviewReason`, `prevTotal`).
- Full API contract: `docs/FRONTEND_BRIEF.md` §1.

## Design system (final — matches `docs/reference/ShoeboxFinal.dc.html`)

A calm, professional bookkeeping tool. Color is reserved for data and for "needs a look". The visual source of truth is the final prototype; when this file and the prototype disagree on a visual detail, the prototype wins.

Tokens (define once in `:root` in `styles.css`, never hardcode elsewhere):
- Canvas `#F5F6F8` · Surface `#FFFFFF` · Ink `#14161A` · Ink-soft `#5A606B` · Border `#E3E6EA` · Border-strong `#D5D9DF` · Wash `#EEF0F3`
- Spend up (worse) `#B4471F` · Spend down (better) `#1F5FBF` — always with an arrow or sign, never color alone
- Needs a look: wash `#FFF6EE`, border `#F4DCC6`, text `#5C4632`, accent `#D9480F` (flagged fields only)
- Categories (the ONLY saturated colors; same color everywhere): Groceries `#4C9A62` · Transportation `#3473D6` · Shopping `#7B5BC4` · Dining `#E0702E` · Other `#9AA0AA` · Health `#D24D67` · Entertainment `#D4A72C` · Travel `#2A9BA3`. Unselected months use the same colors tinted ~62% toward white.
- Type: IBM Plex Sans (UI) + IBM Plex Mono with tabular figures for EVERY money amount, date and count. Self-host via Fontsource.
- Hero sentence 46px weight 400 with the amount in 600; answer sentences 16–21px; body 14px; labels 12–13px.
- Spacing 4/8/12/16/20/24/32/48. Radius 6 (buttons, inputs, chips) / 8 (cards). 1px borders on white over the canvas; shadows only on the review sheet and toasts.
- Icons: `lucide-react` only, 16px, stroke 2. Never emoji.

## Motion

- Library: `motion` (import from `motion/react`). 200–320ms, easing `cubic-bezier(0.23, 1, 0.32, 1)`.
- Text and sections fade up 8px on load and on every month or category change (stagger ~60ms). Daily bars grow from the baseline on month change. Expanding a finding fades its content in and rotates the chevron.
- Review moves between receipts with a short slide; "All caught up" fades in. Toasts rise in.
- Animate only `transform` and `opacity`. Buttons press to `scale(0.97)`. Hover only under `@media (hover: hover)`.
- `prefers-reduced-motion`: 150ms fades, no movement.

## Rules

- Never: purple/indigo accents, gradients, gradient text, glow, glassmorphism, emoji icons, default shadcn/Tailwind look, a centered hero + three cards, every card animating on hover, "Supercharge/Unleash" copy.
- Copy is specific and plain: "You spent $96 less than October", not "Great job managing your finances!"
- Accessibility: real `<button>`/`<a>`/`<label>`; visible focus ring (2px Ink, 2px offset); text contrast ≥ 4.5:1; touch targets ≥ 44px; charts get a text equivalent (`aria-label` or a visually-hidden table).
- Layout: content max-width 1120px, centered, 24px side padding (16px under 640px). Nothing stretches edge to edge on a wide monitor. No empty gaps wider than 64px inside a card.
- New npm dependencies allowed without asking: `motion`, `lucide-react`, Fontsource font packages, `@playwright/test` (dev). Anything else: ask first.
- Don't touch `backend/` except `backend/scripts/` and deleting the empty `backend/app/insight_routes.py`. Backend changes are Aiden's.

## Tools and skills in this repo

- Skills load automatically when the task matches; don't wait to be told. `frontend-design` for building UI, `dev-loop` for every feature, `best-of-n` when a layout has several plausible directions.
- Impeccable: use only `/impeccable critique` (and the free `npx impeccable detect`) on a finished slice. Don't use its full build mode; this file is the design system.
- Playwright MCP: after each slice, open http://localhost:5173, log in as the demo user, and screenshot at 1440, 768 and 390 wide. Look at the screenshots before claiming done.
- Context7: check current docs for `motion`, React 19 and Vite 8 APIs instead of guessing.

## Workflow

Work on branch `fe/insights-dashboard` (or a new `fe/*` branch). Per slice: implement → run → screenshot + inspect → fix → `npm run lint` + `npm run build` + e2e test → commit with a clear message. Never push or open a PR unless Robert asks.
