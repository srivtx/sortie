<div align="center">

<a href="./public/logo.svg"><img src="./public/logo.svg" width="120" alt="SORTIE" /></a>

# SORTIE

**Semantic execution debugger for Solana transactions.**

Decode failures (`0x1771` → "slippage tolerance exceeded"). Trace CPI trees. Profile
compute. Let AI agents inspect transactions through MCP.

[![Live](https://img.shields.io/badge/demo-sortie--six.vercel.app-blue)](https://sortie-six.vercel.app)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](./CHANGELOG.md)
[![License MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Solana](https://img.shields.io/badge/Solana-9945ff?logo=solana&logoColor=white)](https://solana.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

[Live demo](https://sortie-six.vercel.app) · [Report bug](https://github.com/srivtx/sortie/issues) · [Request feature](https://github.com/srivtx/sortie/issues)

</div>

---

## What it does

When a Solana transaction fails on mainnet, the raw error is useless:
`InstructionE...: custom program error: 0x1771`. SORTIE does the work you
shouldn't have to:

1. **Decodes the error** — maps the program ID + instruction index + error
   code to a human-readable string. "Slippage tolerance exceeded on output
   token." Covers 12+ protocols (Jupiter, Raydium, Orca, Drift, Meteora,
   Kamino, Mango, Marinade, Sanctum, SPL Token, System, Associated Token).
2. **Reconstructs the CPI tree** — the full call stack with parent/child
   relationships. Failed branches highlighted. Per-instruction status, compute,
   error. Drag to explore.
3. **Profiles compute** — per-step CU breakdown. Hot spots, by-program totals,
   optimization hints when something eats >80% of the budget.
4. **Streams live failures** — recent failed transactions on mainnet,
   sampled from a public RPC. Refreshes every 15s. Click any to debug.
5. **Exposes it to AI agents via MCP** — JSON-RPC 2.0 endpoint at
   `/api/mcp`. Four tools: `explain_failure`, `analyze_transaction`,
   `list_protocols`, `get_recent_failures`. Works with Claude Code, Codex,
   any MCP-compatible client.

## Quick start

```bash
git clone https://github.com/srivtx/sortie.git
cd sortie
npm install
npm run dev
# → http://localhost:3000
```

Open `http://localhost:3000` for the live failure feed. Paste any Solana
transaction signature (or click one in the feed) to debug it.

## MCP setup

The MCP endpoint is at `http://localhost:3000/api/mcp`. Configure your AI
agent:

```json
{
  "mcpServers": {
    "sortie": {
      "url": "http://localhost:3000/api/mcp",
      "transport": "http"
    }
  }
}
```

Four tools:

| Tool | What it does |
|---|---|
| `explain_failure` | Decode a transaction error: program, instruction, error code, likely cause |
| `analyze_transaction` | Full analysis: CPI tree, compute profile, step-by-step timeline |
| `list_protocols` | List all supported protocols and their decoders |
| `get_recent_failures` | Recent failures across the network (filter by program) |

A live playground is at `/mcp-demo` — try each tool from your browser.

## Architecture

```
sortie/
├── app/
│   ├── page.tsx                    # live failure feed (home)
│   ├── tx/[signature]/page.tsx     # transaction detail (5 tabs: timeline / tree / profile / logs / raw)
│   ├── mcp-demo/page.tsx           # MCP playground
│   └── api/
│       ├── mcp/route.ts            # MCP JSON-RPC 2.0 server
│       ├── recent-failures/        # live failure sampler
│       └── transaction/[signature]/ # transaction fetcher
├── components/                     # reusable UI primitives
│   ├── CpiFlow.tsx                 # React Flow CPI tree
│   ├── ExecutionTimeline.tsx       # step-by-step walk
│   ├── ComputeProfiler.tsx         # CU breakdown + hot spots
│   ├── FailureAnalysis.tsx         # auto-categorized errors
│   ├── RecentFailures.tsx          # live feed component
│   ├── CopyButton.tsx              # one-click clipboard
│   └── ThemeToggle.tsx             # light/dark
├── lib/
│   ├── ir/                         # intermediate representation
│   │   ├── types.ts                # ExecutionStep, Action, etc.
│   │   └── builder.ts              # parse raw tx → IR
│   └── parser/                     # Solana-specific parsers
│       ├── transaction.ts          # main entry
│       ├── instructions.ts         # instruction decoding
│       ├── errors.ts               # error code → human readable
│       ├── logs.ts                 # program log parsing
│       ├── balances.ts             # balance change extraction
│       └── protocols/              # per-program decoders
├── public/                         # logo, favicon
└── tailwind.config.ts              # design tokens
```

### Data flow

```
Public RPC → Solana transaction
  ↓
lib/parser/transaction.ts
  ↓
Intermediate Representation (IR): tree of ExecutionSteps
  ↓
Components render the IR:
  CpiFlow         → the call tree
  ExecutionTimeline → chronological steps
  ComputeProfiler → CU breakdown
  FailureAnalysis → error categorization
```

The IR is the key abstraction. Add a new program decoder → it
automatically works in every view (live feed, timeline, CPI tree,
failure decoder).

## Adding a new program decoder

```ts
// lib/parser/protocols/my-program.ts
import { ProtocolDecoder } from './types';

export const myProgram: ProtocolDecoder = {
  programId: 'MyProgram11111111111111111111111111111111',
  decodeError: (code: number) => {
    const errors: Record<number, string> = {
      0: 'Success',
      1: 'Insufficient liquidity',
      2: 'Slippage exceeded',
    };
    return errors[code] ?? `Unknown error: 0x${code.toString(16)}`;
  },
  decodeInstruction: (data: Buffer) => ({
    type: 'swap',
    params: { /* parsed fields */ },
  }),
};
```

Register it in `lib/parser/protocols/index.ts`. It shows up in the live
feed, the failure decoder, the timeline, and the MCP tool responses —
everywhere.

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS 3 with custom design tokens (CSS variables for
  light/dark theming)
- **Visualization:** React Flow (CPI tree)
- **Icons:** Lucide React
- **Data:** Public Solana RPC (no API key required for read-only calls)
- **MCP:** Hand-rolled JSON-RPC 2.0 server (no SDK — small surface, full
  control)

## Supported programs

- **Jupiter** — aggregator, slippage errors
- **Raydium** — AMM, pool errors
- **Orca** — AMM (Whirlpools)
- **SPL Token** — token program, transfer errors
- **System Program** — account creation, transfers
- **Associated Token** — ATA derivation
- **Marinade** — liquid staking
- **Mango** — perp dex
- **Meteora** — DLMM
- **Drift** — perpetuals
- **Kamino** — lending
- **Sanctum** — LSTs

Open an issue or PR to add more. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for the protocol-decoder spec.

## Development

```bash
npm install        # install deps
npm run dev        # dev server
npm run build      # production build
npm start          # serve production build
npm run lint       # next lint
npx tsc --noEmit   # type-check
```

### Conventions

- **TypeScript strict** — `"strict": true` in `tsconfig.json`. No `any`
  in committed code.
- **Server components by default** — only `'use client'` when you need
  state, effects, or browser APIs.
- **Design tokens via CSS variables** — colors in `:root` in
  `app/globals.css`, exposed via `tailwind.config.ts`. Theme switching
  works without re-renders.
- **No external state library** — local state, URL state, server state
  via fetch. Add Zustand/Redux only if you actually need it.
- **Public RPC by default** — no API key needed for read-only calls.
  For production, switch to Helius/QuickNode.

## Deployment

Deploys to Vercel with zero config:

```bash
vercel
```

Or any Next.js-compatible host. The MCP endpoint is a standard Next.js
API route — works on Vercel, Netlify, Cloudflare Pages, your own Node
server.

**Environment variables:** none required for the public RPC. If you
want a private RPC:

```bash
# .env.local
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

Then update `lib/parser/transaction.ts` to use it.

## Performance

- Transaction parsing: < 50ms for typical transactions (10-20 instructions)
- CPI tree render: < 100ms for trees up to ~100 nodes
- Live failure feed: 15s refresh interval, 4 RPC calls/min (well under
  public RPC limits)
- MCP server: stateless, ~2s for a full `analyze_transaction` call

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full guide on adding
program decoders, reporting issues, and the PR process.

## License

[MIT](./LICENSE) — Copyright (c) 2026 [srivtx](https://github.com/srivtx)

## Acknowledgments

- [Solana](https://solana.com) — the chain
- [React Flow](https://reactflow.dev) — the tree visualization
- [Anza](https://anza.xyz) (formerly Solana Labs) — the RPC and tooling
- [Helius](https://helius.xyz) — reference docs and transaction parsing
  examples
- The Solana developer community — bug reports, feedback, and protocols
  to decode

## Contact

- GitHub: [@srivtx](https://github.com/srivtx)
- Issues: [github.com/srivtx/sortie/issues](https://github.com/srivtx/sortie/issues)
- Live demo: [sortie-six.vercel.app](https://sortie-six.vercel.app)

---

<sub>Built for the [Superteam Earn](https://superteam.fun) "Ship useful
agent skills" bounty. Released under MIT.</sub>
