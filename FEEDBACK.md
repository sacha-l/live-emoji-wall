# FEEDBACK — modding & deploying the Polkadot Playground template

Running log of the "can we actually mod and deploy this?" experiment.
**Mod chosen:** Live Emoji Wall using `@parity/product-sdk-statement-store`
(real-time P2P pub/sub) — the most "advanced/multiplayer" of three candidate ideas.

Environment: macOS (darwin 25.5), Node v25.1.0, npm 11.6.2, git 2.44.0,
`playground` CLI v0.39.0.

**Bottom line:** modding **and** deploying both work. The template clones, sets up,
accepts a non-trivial mod (swapping the sign demo for a Statement Store pub/sub
emoji wall), builds, renders, and `playground deploy` publishes it to a real
`.dot` domain + the Playground registry.

---

## ⛳ Issues & suggestions

### Issues observed

| Error/Issue/Bug | Severity | Version | Status | Workaround |
|---|---|---|---|---|
| **statement-store skill docs ahead of the shipped package** (mod-side) — `references/statement-store-api.md` documents `StatementStoreConfig.pollIntervalMs`/`.endpoint` and a `client.query()` method that don't exist in the shipped package. Caught at `tsc` build (loud, not silent). | 🟡 Moderate | `@parity/product-sdk-statement-store` **0.4.7** | Open | Trust `dist/index.d.ts`; use only `connect`/`publish`/`subscribe`/`isConnected`/`getPublicKeyHex`/`destroy` |
| **A freshly-paired session can't deploy until the on-chain Bulletin storage allowance is approved** — otherwise deploy fails with `Could not resolve the Bulletin storage key for this session … not authorized on-chain yet`. The error is clear and actionable, but only surfaces at deploy time. | 🟢 Low | CLI **v0.39.0** | Open / ~by-design | Complete `playground login` (without `-y`) and approve the Bulletin storage-allowance prompt on the phone |
| **CLI is interactive-only (Ink); needs a real TTY** — no headless/CI path, so it can't be driven from a non-interactive shell. | 🟢 Low | CLI **v0.39.0** | Open / by-design | Run in a real terminal, or allocate a PTY (e.g. `script`) |

### Suggestions

- **Add a "use the latest versions" check to the template** (e.g. in `setup.sh`
  and/or a note in `CLAUDE.md`/`DEPLOYMENT.md`) so contributors are on the latest
  `playground` CLI and `@parity/product-sdk-*` packages before they deploy. Stale
  tooling is the single biggest avoidable source of deploy friction; a quick
  `playground update` reminder (and an SDK-version sanity check) up front would
  save a lot of confusing failures.
- **Surface session/allowance state up front.** The deploy is the first place that
  reveals an unauthorized Bulletin allowance — a pre-flight check (or a hint in
  `playground login`) that the session is fully deploy-ready would help.

> Good to know (not issues): deploy needs `--no-contracts` for a frontend-only app
> (otherwise it runs a Rust/CDM contract deploy pre-step); and `.dot.li` content
> lives on **Bulletin Chain**, not the public IPFS DHT, so a freshly-deployed site
> only renders in a real browser/Polkadot host (not `curl` or a headless light
> client), and can take a few minutes to propagate.

---

## Timeline / observations

### 1. Scaffolding (`git clone` + re-init) — ✅ clean
- `git clone https://github.com/paritytech/playground-app-template.git .` worked cleanly.
- Re-initialized git so this is our own repo (template ships its own `.git`).
- Repo is well-documented: `CLAUDE.md`, `DEPLOYMENT.md`, `AGENTS.md`,
  `.clinerules`, `.windsurfrules` — clearly built to be driven by AI agents.
- ⚠️ Note for anyone modding: `CLAUDE.md` has a hard rule — **never escape the
  host with direct RPC**. All chain/storage/pubsub must go through
  `@parity/product-sdk-*` + the Host API. A statement-store mod must use the SDK,
  not a raw node socket.

### 2. `setup.sh` — ✅ smooth
- Installed 398 packages in ~10s. Two deprecation warnings (`node-domexception`,
  `@substrate/connect@0.8.11`) — cosmetic, upstream transitive deps.
- Fetched 8 SDK skills into `.claude/skills/` exactly as advertised, including
  `product-sdk-statement-store` (`SKILL.md` + `references/statement-store-api.md`).
- Nice touch: the repo ships agent guidance for Claude/Cline/Windsurf and a
  `SessionStart` hook — clearly designed for AI-driven modding.

### 3. Adding the advanced SDK — ✅ clean
- `npm install @parity/product-sdk-statement-store` → resolved to **0.4.7**, added
  34 packages, **no peer-dep conflicts** (its only peer dep,
  `@novasamatech/host-api-wrapper >=0.8.0`, is satisfied by the template's pinned
  `0.8.7`).
- `npm audit` reported 4 vulns (1 low, 3 high) in the dep tree — did not block the
  build; not investigated (prototype/research code per the repo's own disclaimer).

### 4. ⚠️ Skill docs vs. shipped package — API drift (the one real snag)
`references/statement-store-api.md` documents APIs that **do not exist** in the
installed `0.4.7`:
- `StatementStoreConfig.pollIntervalMs` / `.endpoint` / `.enablePolling` — **not in
  the shipped type.** Real config is only `{ appName, defaultTtlSeconds?, transport? }`.
- `StatementStoreClient.query<T>(...)` — **does not exist.** Real public methods:
  `connect`, `publish`, `subscribe`, `isConnected`, `getPublicKeyHex`, `destroy`.

Caught at `tsc` build time (TS2353 / TS2339) — failed loud, not silent. Fix: drop
`pollIntervalMs` and the `query()`-based seeding and rely on `subscribe()` (which
delivers existing un-expired statements + new ones via its internal polling).
**Takeaway: trust `node_modules/.../dist/index.d.ts` over the skill reference.**

### 5. ⚠️ Pinned `host-api` has a documented Desktop regression (template note)
`package.json` carries a maintainer `_comment_overrides` note: `@novasamatech/host-api*`
is pinned to exact `0.8.7`, with a warning that `0.8.4+` had a handshake regression
against older Polkadot Desktop builds (*"if it hangs on 'Polkadot host is not
ready', revert host-api* to 0.8.3 and product-sdk-host below 0.10.0"*). Flagging
for whoever tests in a real Desktop host — our mod didn't touch these pins.

### 6. Build & local verify — ✅
- `npm run build` (`tsc -b && vite build`) passes; `dist/` is **468 KB**
  (1043 modules, largest gzip chunk ~127 KB — the polkadot-api stack).
- Dev server (`npm run dev`) serves HTTP 200 on :5173.
- Loaded in a real browser (Playwright): **0 console errors**, renders perfectly
  (emoji grid, "No host" status, hint, info card — see `emoji-wall-local.png`).
- The only console output is the expected `[signer:host] not inside a host
  container — Host API unavailable` warning. **This is correct:** the Host API
  (and therefore the Statement Store's `mode: "host"` connect, the product account,
  and signing) only light up inside a Polkadot host (Mobile / Desktop / Web).
- ⛔ **Pub/sub can't be fully exercised locally.** Confirming a reaction tapped in
  one session appears in another needs a real Polkadot host + a second session —
  only possible post-deploy, inside a host. Everything up to the host boundary is
  verified.

> Possible enhancement (not done): the SDK also supports `connect({ mode: "local",
> signer })` against a Bulletin endpoint, which could let the wall run outside a
> host for local testing — but `CLAUDE.md` forbids escaping the host with a direct
> endpoint, so we stuck to host mode as intended.

### 7. Deploy — ✅ SUCCESS
- `playground` CLI present and used to pair the phone (`playground login` — QR scan
  + on-phone approval, including the Bulletin storage allowance), then:
  `playground deploy --no-build --buildDir dist --domain live-emoji-wall --signer phone --playground --tag social --no-contracts`.
- Uploaded the build to Bulletin (chunked) and completed the **4 phone approvals**
  (Reserve domain → Finalize domain → Link content → Publish to registry), with the
  deliberate ~60s DotNS commit-reveal pause between the first two.

```
✔ Deploy complete
  URL          https://live-emoji-wall.dot.li
  Domain       live-emoji-wall.dot
  App CID      bafybeieeo2sei4dieifu2bnifbcdhpmchigpbhqy7s6bmzojxckhc2tae4
  IPFS CID     bafybeih3km7urmosucnheex2ph6x73aeqta22oe4ztxpwsegblakenikxa
  Metadata CID bafk2bzacecko7eqihlyrc3ypb2ctwsujqau2jww33iswn3nz7fedd3rab254c
```

Published to the Playground registry (tag: `social`). **So the headline question
of this experiment is answered: yes — modding and deploying both work.**

ℹ️ **Gateway propagation (expected).** Right after deploy,
`https://live-emoji-wall.dot.li` can still show "This app can't be reached" while
the light client/Bulletin propagate the fresh contenthash. Give it a few minutes
and hard-refresh (Cmd/Ctrl+Shift+R) in a normal browser, and/or open
`live-emoji-wall.dot` inside Polkadot Desktop/Mobile — which is also the only place
the app *fully* works (Host API → product account + the live Statement Store wall).
A headless browser is **not** a reliable check here: the `.dot.li` resolver runs an
in-browser smoldot light client that needs WebRTC/relay networking to sync, which
headless Chromium can't reliably establish. The deploy itself is confirmed complete
on-chain (CLI `✔ Deploy complete`, contenthash linked to the App CID, published to
the registry); only the visual web render is best confirmed by a human.

---

## TL;DR — does modding + deploying work?
**Yes.** The template clones, sets up, and accepts a non-trivial mod (swapping the
sign demo for a Statement Store pub/sub emoji wall) cleanly; it builds and renders
with zero console errors; and `playground deploy` publishes it to a real `.dot`
domain + the Playground registry. The one genuine technical finding is **mod-side
SDK doc drift** (skill docs ahead of `statement-store@0.4.7` — caught at compile);
the rest are low-severity, well-signposted setup steps (approve the Bulletin
allowance during `login`; the CLI is interactive-only). Main suggestion: **add a
"use the latest CLI + SDK versions" check to the template** (`setup.sh`/`CLAUDE.md`)
and surface session/allowance readiness before deploy.
