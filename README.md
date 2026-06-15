> [!WARNING]
> The following is a prototype, reference implementation, and proof-of-concept. This open source code is provided for research, experimentation, and developer education only. This code has not been audited, is actively experimental, and may contain bugs, vulnerabilities, or incomplete features. Use at your own risk.


# Live Emoji Wall

A real-time, serverless **emoji reaction wall** built on the Polkadot Playground
template. Tap an emoji and it's published as a small **signed statement** over the
**Polkadot Statement Store** (`@parity/product-sdk-statement-store`) — a P2P
pub/sub layer on the Bulletin Chain. Every open session subscribes to the same
room and streams everyone's reactions in real time. No server, no database, no
hosting bill — just the host and the chain.

> This is a **mod** of the [Polkadot Playground template](https://github.com/paritytech/playground-app-template):
> the original message-signing demo is replaced with the emoji wall to prove out
> using an "advanced" host capability (real-time pub/sub) end-to-end. React 19 +
> Vite + TypeScript, wired to the Polkadot Host API.

Open it inside a Polkadot host (Mobile, Desktop, or Web) so the Host API can hand
the app its product account and a `StatementStoreAllowance`. In a plain browser
tab the UI renders but the wall stays in a "No host" state — there's no host to
talk to. Signing is approved on Polkadot Mobile; Desktop and Web relay the
request to your paired phone.

## How it works

- **`src/EmojiWall.tsx`** — creates a `StatementStoreClient({ appName: "playground-emoji-wall" })`,
  `connect`s in `mode: "host"` with the product account, `subscribe`s to the
  `lobby` room (topic2), and `publish`es a tiny `{ e, t, id }` payload per tap
  (well under the 512-byte statement limit). Incoming statements stream into a
  capped, de-duped feed; the publisher is read from each statement's `signerHex`.
- **`src/App.tsx` / `src/App.css`** — the app shell + the host resource panel,
  which shows the `Statement store` allowance the wall depends on.
- **`src/utils.ts`** — unchanged template signer/host wrapper (already requests
  `StatementStoreAllowance`).

## Mod it further

- **More signal** — broadcast presence/typing, a shared cursor, or a lightweight
  chat using the same Statement Store room (last-write-wins `ChannelStore` is
  built in).
- **Persist beyond TTL** — statements expire (default ~30–90s); pair with
  `@parity/product-sdk-bulletin` for durable off-chain storage.
- **Gate it** — add PoP/allowlist rules with `@parity/product-sdk-contracts`.

See [CLAUDE.md](CLAUDE.md) for the full SDK stack table.

## Stack

- **React 19** + **Vite** + **TypeScript**
- **`@parity/product-sdk-signer`** — Host signer management and app-scoped product-account signing
- **`@parity/product-sdk-host`** — TruAPI helpers for the Polkadot host (Mobile, Desktop, or Web)
- **`@novasamatech/host-api`** (+ `@novasamatech/host-api-wrapper`) — TruAPI runtime used underneath the Product SDK packages

## Running

```bash
./setup.sh    # installs deps + fetches the @parity/product-sdk skills
npm run dev
```

`setup.sh` installs `node_modules/` and pulls the `@parity/product-sdk` skills
into `.claude/skills/` so AI coding assistants (Claude Code, Cursor, Windsurf,
Copilot, Gemini) have the Polkadot SDK guidance on hand. The skills are fetched
from [paritytech/product-sdk](https://github.com/paritytech/product-sdk), not
committed here, so they stay current — re-run `./setup.sh --refresh` to update
them. (Plain `npm install` also works if you don't want the skills.)

Runs on `http://localhost:5173`. Must be opened inside a **Polkadot host** (Mobile, Desktop, or Web) for Host API login to work; signing is approved on Polkadot Mobile.

Product-account signing is scoped to the host's current app identifier. Local dev uses the current loopback host, e.g. `localhost:5173`; `.dot.li` gateway URLs are mapped back to their `.dot` product id. Set `VITE_PRODUCT_ACCOUNT_ID` when you need an explicit override.

## Structure

```
src/
├── App.tsx        # Header + app shell + host resource panel
├── EmojiWall.tsx  # The mod: Statement Store pub/sub emoji wall
├── utils.ts       # Product SDK signer wrapper + small helpers
└── main.tsx       # Vite entry
```

## Deploying

A `/deploy <name>` slash command is wired up for Claude Code users — it runs `playground deploy` (the [Playground CLI](https://github.com/paritytech/playground-cli)) against `<name>.dot` using the phone signer. Standalone:

```bash
npm run build
playground deploy --no-build --buildDir dist --domain <name>.dot --signer phone --playground
```

## Ideas for modding

### Beginner — UI and frontend

- Reskin it — change colours, typography, visual style
- Rename everything — app name, labels, descriptions
- Add a tagline and hero section
- Make it mobile-first
- Add dark/light mode toggle
- Add a second language
- Design a custom empty state

### Intermediate — storage and data

- Add a new data field stored on decentralised storage
- Add rich text editing
- Add image upload stored on decentralised storage
- Add a comments section using Statement Store
- Add client-side search and filter
- Add pagination
- Add timestamps
- Add data export as JSON

### Advanced — smart contracts (requires [CDM](https://github.com/paritytech/contract-dependency-manager)/Rust, laptop required)

- Enforce a character limit at contract level
- Add item expiry after a set number of blocks
- Add a cap on total submissions
- Add PoP gating — only verified humans can participate
- Add an allowlist of approved accounts
- Add an admin-only moderation function
- Change the voting or selection mechanic
- Add a contract event so the UI can react in real time
- Require multi-sig approval

### Advanced — multiplayer and cross-account

- Add a challenge mechanic via Statement Store
- Add an on-chain leaderboard
- Add Statement Store notifications
- Add a tipping mechanic using PGAS

## Security

> [!WARNING]
> The following is a prototype, reference implementation, and proof-of-concept. This open source code is provided for research, experimentation, and developer education only. This code has not been audited, is actively experimental, and may contain bugs, vulnerabilities, or incomplete features. Use at your own risk.

This is a reference proof-of-concept, **not a hardened production build**. Before
deploying it for any real use case, you are responsible for:

- Reviewing the code yourself.
- Checking that dependencies are up to date and free of known vulnerabilities.
- Securing your own fork or deployment environment (keys, secrets, network configuration).
- Tracking the latest tagged release / commits for security fixes — older releases
  are not backported (exceptions might apply).

For Parity's security disclosure process and Bug Bounty program, see
[parity.io/bug-bounty](https://parity.io/bug-bounty).

## License

Licensed under the [GNU General Public License v3.0 or later](./LICENSE) (`GPL-3.0-or-later`).
