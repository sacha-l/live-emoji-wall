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

**Pre-check via `playground init`:** the account was **already paired + funded** —
`✓ logged in … playground.dot/0`, `✓ allowances already granted`, `✓ funding
already funded`. So no QR/phone pairing and no faucet top-up were needed.

⚠️ **CLI needs a real TTY (Ink raw-mode).** Running `playground init` from a
non-interactive shell crashed at its first interactive prompt with:
`ERROR Raw mode is not supported on the current process.stdin, which Ink uses as
input stream by default.` The Playground CLI is an Ink (React-for-CLI) app, so
every interactive step (preflight confirm, username prompt, etc.) requires a
pseudo-terminal. Headless `child_process` capture won't work — you must run it in
a real terminal, or allocate a PTY (e.g. `script`/`pty`). Led the deploy by
wrapping it in `script` to give it a PTY.

ℹ️ Also passed **`--no-contracts`**: this is a frontend-only app, and `playground
deploy` otherwise runs a contract deploy/install pre-step automatically (would
need Rust/CDM). Skipping it is correct here.

**Deploy run #1 — aborted at signing step 1 (expired phone session).**
The deploy executed correctly up to the first on-chain signature:
- ✔ `live-emoji-wall.dot is available`
- ✔ preflight printed (4 approvals expected; the PTY auto-Enter cleared it)
- ✔ uploaded the build to Bulletin in chunks (`chunk 1/1`, `chunk 1/2`, `chunk 2/2`)
- 📱 reached `Approve on your phone (step 1): Reserve domain` …
- ✖ then **failed**: `Phone session expired: the statement-store allowance lapses
  ~2-3 days after login and cannot be renewed remotely (renewal requests travel
  over the expired channel).`

⚠️ **This is a real, sharp-edged gotcha worth surfacing to Parity:** the phone
pairing silently expires after ~2-3 days, and the *deploy itself* is what
discovers it — at signing step 1, **after** it has already uploaded the build to
Bulletin. The `init` pre-check even reported `✓ logged in / allowances already
granted / funding already funded`, so nothing up front warned that signing was
actually dead. Net: a stale session wastes an upload and a few minutes before
failing. Nothing was registered on-chain (it died before the DotNS commit), so
the domain is still free and re-running after re-pairing is safe.

Also seen (non-blocking): `⚠ Update available: v0.33.1 → v0.39.0`.

**Resolution:** re-pair (`playground logout` → `playground init`) then re-deploy.
Because `init` shows a QR **and** is an Ink TTY app, it must be run in a real
terminal by the user (it can't be driven headless from here). **Re-pairing snag → fixed with `init -y`.** On re-pair, `playground init` paired
the phone fine but then **errored on the username step**:
`Couldn't save your username: Transaction dispatch failed: Revive.ContractReverted`
— i.e. the playground registry (a pallet-revive/PolkaVM contract) reverted the
username-save tx (most likely the username was already registered to this same
account from the prior pairing). The pairing/login itself had already succeeded,
so this is a non-fatal post-login step, but it makes plain `init` exit as a
failure and is confusing. **Workaround: `playground init -y`** (skip interactive
prompts) → `✓ setup complete`, session freshly paired, username step bypassed.
(Another rough edge to report: a username collision on re-pair shouldn't hard-fail
`init`.)

_Re-pair done. Deploy run #2 result appended below._

**Deploy run #2 — domain registered, but stalled at step 3.**
With a fresh session the phone signing worked this time:
- ✔ uploaded to Bulletin (`chunk 2/2`)
- ✔ **step 1 Reserve domain** — approved on phone
- ✔ **step 2 Finalize domain** — approved on phone → **`live-emoji-wall.dot` is now
  registered to the account** (DotNS reserve+finalize = register)
- 📱 **step 3 Link content (setContenthash)** — then **failed**:
  `✖ storage-and-dotns: transaction watcher silent for 90s after (none)`.

⚠️ The CLI's transaction watcher timed out after 90s waiting on step 3 (the
`(none)` is an odd diagnostic — no tx context). Each phone approval has a ~90s
window; miss it (or hit watcher flakiness over the statement-store channel) and
the run aborts. Because steps 1-2 committed, the **domain is owned**, so a re-run
resumes from link-content with fewer approvals (per `DEPLOYMENT.md`'s "redeploy"
note). Re-running now.

_Deploy run #3 result appended below._

**Deploy run #3 — same wall at `Link content`, now confirmed on-chain.**
This run also prompted (and we approved) an `Increase Bulletin storage allowance`
step first, then re-ran the domain sequence: ✔ Reserve, ✔ Finalize, then **✖
`Link content (setContenthash)` failed again** with the identical
`transaction watcher silent for 90s after (none)`.

**Verified the impact in a real browser:** loading `https://live-emoji-wall.dot.li`
in Chromium shows the resolver recognizes the domain (`live-emoji-wall.dot` in the
header, "Verified/Trusted" badge) **but renders "This app can't be reached"** —
i.e. the domain is registered (reserve+finalize landed) but **has no content hash**
(setContenthash never landed). So the failure is real, not just a cosmetic watcher
glitch. (Side note: `https://<name>.dot.li` to `curl` returns the generic Polkadot
resolver shell — 20 KB, title "Polkadot — The decentralized web…" — only a real
browser runs the client-side resolver, exactly as `DEPLOYMENT.md` warns.)

🔴 **This is the headline bug to report:** on CLI **v0.33.1**, the `setContenthash`
("Link content") step of `playground deploy` reproducibly fails — its tx watcher
reports `(none)` (no tx hash to follow) and gives up after 90s — leaving a
**registered-but-unreachable** `.dot` domain. Reproduced twice. The CLI also
nags `Update available: v0.33.1 → v0.39.0`, so trying the newer CLI is the
obvious next step.

**Upgraded to v0.39.0** (`playground update` — clean, headless). Deploy flags
unchanged. But:

⚠️ **The upgrade invalidated the existing phone session** — v0.39.0's deploy
errored immediately: `✖ Mobile (phone) signing needs a logged-in session. Run
"playground login" to pair your phone`. So a CLI upgrade forces a **full
re-pair**.

⚠️ **More command-name churn:** v0.33.1 paired via `playground init`; **v0.39.0
renamed it to `playground login`** (matching the original `DEPLOYMENT.md`, which
v0.33.1 had contradicted). Three doc/CLI generations disagree on whether it's
`login` or `init` — a real papercut for following written instructions.
(v0.39.0 also adds `playground drip` to self-serve testnet PAS.)

_Re-pairing on v0.39.0 via `playground login`; deploy run #4 result below._

**Deploy run #4 (v0.39.0) — blocked on Bulletin storage allowance not authorized.**
After re-login, deploy failed before uploading:
> ✖ Could not resolve the Bulletin storage key for this session (Bulletin
> allowance account `5Dnj5…qkDg` is not authorized on-chain yet … Storage uploads
> are too large to sign on the phone, so deploy cannot continue.)

⚠️ **Interaction between two earlier papercuts bites here:** the username
`ContractReverted` error on `login` had pushed us to `login -y`, and **`-y`
(skip prompts) also skips initiating the Bulletin storage-allowance grant** — so
the new session key was never authorized on-chain for Bulletin. The deploy can't
proceed without it (uploads exceed per-request phone-signing size). Fix: re-run
**plain** `playground login` and approve the **Bulletin allowance** prompt on the
phone (it precedes the username step, so the trailing username revert is
harmless). Net lesson worth reporting: `login -y` produces a session that *looks*
logged-in but **can't deploy**, with no warning until deploy time.

_Re-running plain `playground login` to grant the Bulletin allowance; deploy run
#5 result below._

**Deploy run #5/#6 (v0.39.0, allowance granted) — ✅ SUCCESS.**
With the Bulletin allowance authorized, the deploy ran end-to-end. Crucially,
**`Link content (setContenthash)` succeeded this time** (`✔ storage-and-dotns`) —
i.e. **the v0.39.0 upgrade fixed the 90s tx-watcher bug** that killed runs #2/#3.
All four phone approvals landed (Reserve → Finalize → Link content → Publish):

```
✔ Deploy complete
  URL          https://live-emoji-wall.dot.li
  Domain       live-emoji-wall.dot
  App CID      bafybeieeo2sei4dieifu2bnifbcdhpmchigpbhqy7s6bmzojxckhc2tae4
  IPFS CID     bafybeih3km7urmosucnheex2ph6x73aeqta22oe4ztxpwsegblakenikxa
  Metadata CID bafk2bzacecko7eqihlyrc3ypb2ctwsujqau2jww33iswn3nz7fedd3rab254c
```

Published to the Playground registry (tag: `social`). **So: modding AND deploying
the template both work** — the headline question of this experiment is answered
**yes**.

ℹ️ **Gateway propagation lag (expected):** immediately after deploy,
`https://live-emoji-wall.dot.li` still rendered "This app can't be reached" (even
after a cache-bust). No console errors — the resolver verifies the domain via the
light client but hadn't yet synced the block carrying the fresh `setContenthash`.
Per `DEPLOYMENT.md`, give it a few minutes and/or hard-refresh (Cmd/Ctrl+Shift+R),
and open inside a real Polkadot host (Mobile/Desktop/Web) for the full
Host-API-backed experience (product account + the live Statement Store wall).

ℹ️ **Content lives on Bulletin, not public IPFS (diagnostic note).** Tried
fetching the deployed App/IPFS CIDs from public IPFS gateways (`dweb.link`,
`ipfs.io`) to sanity-check availability — both fail (301-to-subdomain / timeout),
because the build is stored on **Polkadot Bulletin Chain**, which is
IPFS-*addressed* but not announced to the public IPFS DHT. So only the `.dot.li`
gateway or a Polkadot host can retrieve it; a "can't be reached" on `.dot.li`
shortly after deploy is light-client/Bulletin propagation lag, not missing
content. _(Gateway go-live re-check appended below.)_

**Gateway re-check (~25 min post-deploy) — inconclusive from a headless browser.**
Reloaded `https://live-emoji-wall.dot.li` several times with long (40-45s) waits;
it kept showing "This app can't be reached." **Concluded this is an environment
limitation, not a deploy failure:** the `.dot.li` resolver runs an **in-browser
light client (smoldot)** that needs WebRTC/relay networking to sync, which the
headless Chromium used here can't reliably establish — so it falls back to "can't
be reached" no matter what. (The "Verified/Trusted" text on the page is a *hover
tooltip* explaining the two load modes, not a live status badge — so a headless
snapshot can't confirm or deny resolution.) **Authoritative verification must be
done by a human:** open the URL in a normal desktop browser (leave it ~30-60s for
the light client to sync; hard-refresh), and/or open `live-emoji-wall.dot` inside
Polkadot Desktop/Mobile — which is also the only place the app *fully* works
(Host API → product account + the live Statement Store wall). The deploy itself
is confirmed complete on-chain (CLI `✔ Deploy complete`, contenthash linked to
App CID, published to registry); only the visual web render is unverified from
here.

## TL;DR — does modding + deploying work?
**Yes.** The template clones, sets up, and accepts a non-trivial mod (swapping the
sign demo for a Statement Store pub/sub emoji wall) cleanly; it builds and renders;
and `playground deploy` publishes it to a real `.dot` domain + the Playground
registry. The friction was **all in tooling, not the template**: (1) SDK skill
docs ahead of the shipped statement-store package; (2) phone sessions silently
expiring after ~2-3 days; (3) `init`↔`login` command churn across CLI versions;
(4) a real `setContenthash` watcher bug in CLI v0.33.1 — **fixed by upgrading to
v0.39.0**; (5) `login -y` producing a can't-deploy session (no Bulletin allowance).
Recommendation to Parity: **ship ≥ v0.39.0 in the install script** and reconcile
the `init`/`login` naming across `DEPLOYMENT.md`/`CLAUDE.md`/CLI.

