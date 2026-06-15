# FEEDBACK — modding & deploying the Polkadot Playground template

Running log of the "can we actually mod and deploy this?" experiment.
**Mod chosen:** Live Emoji Wall using `@parity/product-sdk-statement-store`
(real-time P2P pub/sub) — the most "advanced/multiplayer" of the three ideas.

Environment: macOS (darwin 25.5), Node v25.1.0, npm 11.6.2, git 2.44.0.

---

## Timeline / observations

### 1. Scaffolding (`git clone` + re-init)
- ✅ `git clone https://github.com/paritytech/playground-app-template.git .` worked cleanly.
- Re-initialized git so this is our own repo (template ships its own `.git`).
- Repo is well-documented: `CLAUDE.md`, `DEPLOYMENT.md`, `AGENTS.md`,
  `.clinerules`, `.windsurfrules` — clearly built to be driven by AI agents.
- ⚠️ Note for anyone modding: `CLAUDE.md` has a hard rule — **never escape the
  host with direct RPC**. All chain/storage/pubsub must go through
  `@parity/product-sdk-*` + the Host API. A statement-store mod must use the
  SDK, not a raw node socket.

### 2. `setup.sh` — ✅ smooth
- Installed 398 packages in ~10s. Two deprecation warnings (`node-domexception`,
  `@substrate/connect@0.8.11`) — cosmetic, upstream transitive deps.
- Fetched 8 SDK skills into `.claude/skills/` exactly as advertised, including
  `product-sdk-statement-store` with a `SKILL.md` + full `references/statement-store-api.md`.
- Nice touch: the repo ships agent guidance for Claude/Cline/Windsurf and a
  `SessionStart` hook — clearly designed for AI-driven modding.

### 3. Adding the advanced SDK — ✅ clean
- `npm install @parity/product-sdk-statement-store` → resolved to **0.4.7**, added
  34 packages, **no peer-dep conflicts**. Its only peer dep
  (`@novasamatech/host-api-wrapper >=0.8.0`) is satisfied by the template's
  pinned `0.8.7`.
- `npm audit` reported 4 vulns (1 low, 3 high) in the dep tree — did not block
  build; not investigated (prototype/research code per the repo's own disclaimer).

### 4. ⚠️ Skill docs vs. shipped package — API DRIFT (the one real snag)
The `references/statement-store-api.md` skill documents APIs that **do not exist**
in the installed `0.4.7`:
- `StatementStoreConfig.pollIntervalMs` and `.endpoint` / `.enablePolling` —
  **not in the shipped type.** Real config is only `{ appName, defaultTtlSeconds?, transport? }`.
- `StatementStoreClient.query<T>(...)` — **does not exist** on the shipped class.
  Real public methods: `connect`, `publish`, `subscribe`, `isConnected`,
  `getPublicKeyHex`, `destroy`.

Caught at `tsc` build time (TS2353 / TS2339), so it failed loud, not silent.
Fix was to drop `pollIntervalMs` and the `query()`-based seeding and rely on
`subscribe()` (which delivers existing un-expired statements + new ones via its
internal polling). **Takeaway: trust `node_modules/.../dist/index.d.ts` over the
skill reference — the skill is ahead of (or behind) the published version.**

### 5. ⚠️ Pinned `host-api` has a documented Desktop regression
`package.json` carries a maintainer `_comment_overrides` note: `@novasamatech/host-api*`
is pinned to **exact 0.8.7**, and *"0.8.4+ had a handshake regression against older
Polkadot Desktop builds — if it hangs on 'Polkadot host is not ready', revert
host-api* to 0.8.3 and product-sdk-host below 0.10.0."* Flagging for whoever tests
in a real Desktop host — our mod didn't touch these pins.

### 6. Build & local verify — ✅
- `npm run build` (`tsc -b && vite build`) passes; `dist/` is **468 KB**
  (1043 modules, largest gzip chunk ~127 KB — the polkadot-api stack).
- Dev server (`npm run dev`) serves HTTP 200 on :5173.
- Loaded in a real browser (Playwright): **0 console errors**, renders perfectly
  (emoji grid, "No host" status, hint, info card — see `emoji-wall-local.png`).
- The only console output is the expected `[signer:host] not inside a host
  container — Host API unavailable` warning. **This is correct:** the Host API
  (and therefore the Statement Store's `mode: "host"` connect, the product
  account, and signing) only light up inside a Polkadot host (Mobile / Desktop /
  Web). A plain browser tab has no host to talk to.
- ⛔ **Cannot fully exercise pub/sub locally.** Confirming a reaction tapped in
  one session appears in another requires (a) a real Polkadot host and (b) a
  second session. That end-to-end check is only possible post-deploy, inside a
  host. Everything up to the host boundary is verified.

> Possible enhancement (not done): the SDK also supports `connect({ mode: "local",
> signer })` against a Bulletin endpoint, which *could* let the wall run outside a
> host for local testing — but `CLAUDE.md` explicitly forbids escaping the host
> with a direct endpoint, so we stuck to host mode as intended.

### 7. Deploy — CLI present, but needs your phone (handoff)
- ✅ `playground` CLI already installed: **v0.33.1** (`~/.local/bin/playground`).
- ⚠️ **Docs vs CLI command drift:** `DEPLOYMENT.md` says auth is `playground login`;
  this CLI version has **no `login`** — it's folded into **`playground init`**
  (QR + phone). (The same doc's troubleshooting row claims the opposite — "there
  is no init" — so the doc straddles two CLI generations.)
- No paired session found (`~/.polkadot` has only `bin/`) → a `playground init`
  (scan QR with the Polkadot mobile app) is required before deploying.
- No git `origin` (we re-init'd) → `--moddable` is not available unless the repo
  is pushed to a public GitHub fork first.
- Deploy is **interactive + irreversible + outward-facing**: it registers a public
  `<name>.dot` domain via DotNS and uploads `dist/` to the public Bulletin Chain,
  with ~3–4 approvals tapped on the phone (and a deliberate ~60s commit-reveal
  pause between the first two). It therefore **cannot be run head-less from here**
  — handed the exact command to the user to run in-session. Outcome recorded below.

### Deploy attempt — outcome
_(to be filled in after the user runs the handoff command)_

