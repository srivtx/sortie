<div align="center">

<img src="public/logo.svg" alt="SORTIE" width="80" height="80" />

# SORTIE

**Semantic execution debugger for Solana transactions.**

Decode failures. Trace CPI trees. Profile compute. Let AI agents inspect transactions through MCP.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-9945ff?logo=solana&logoColor=white)](https://solana.com)

[Live Demo](https://sortie-six.vercel.app) · [Report Bug](https://github.com/srivtx/sortie/issues) · [Request Feature](https://github.com/srivtx/sortie/issues)

</div>

---

## The problem

Solana transactions fail in ways that are hard to debug. The error code `0x1771` is meaningless without context. The CPI tree is a black box. Compute usage is opaque. When a transaction fails on mainnet, you need to:

1. Decode the error code (which program? what instruction? what state?)
2. Trace the CPI call stack to find where it broke
3. Profile compute to see what was expensive
4. Replay the transaction to see what would have happened

None of the existing explorers do this well. They show you the raw logs and a JSON tree. You have to do the rest in your head.

**SORTIE does the rest.**

## Features

- **Failure decoder** — `InstructionE...: custom program error: 0x1771` becomes `"Slippage tolerance exceeded on output token"`. 12+ programs decoded, more added regularly.
- **CPI tree visualization** — the full call tree of a transaction, with handles you can drag. Failed branches highlighted. Per-instruction status, compute, error.
- **Execution timeline** — step-by-step walk through the transaction, expandable per instruction. See the exact state at each step.
- **Compute profiler** — per-step CU breakdown. Hot spots, by-program totals, optimization hints when something eats 80% of the budget.
- **Failure analysis** — auto-categorized failure: slippage, compute exceeded, account not found, etc. Severity, cause, suggested fix.
- **Live failure feed** — real-time stream of recent failures across the Solana network. Sample on a public RPC, see what other people are hitting right now.
- **MCP server** — Model Context Protocol endpoint at `/api/mcp`. AI agents (Claude, GPT, custom) can call `explain_failure`, `analyze_transaction`, `list_protocols`, `get_recent_failures` to inspect Solana transactions programmatically.
- **Light/dark theme** — terminal-ops aesthetic in dark, paper-textbook in light. Persisted to localStorage.
- **Copy buttons** — signatures, share URLs, MCP config, code snippets. One click, in your clipboard.

## Quick start

```bash
git clone https://github.com/srivtx/sortie.git
cd sortie
npm install
npm run dev
# → http://localhost:3000
```

Open `http://localhost:3000` for the live failure feed. Paste any Solana transaction signature (or click one in the feed) to debug it.

### Using the MCP server

The MCP endpoint is at `http://localhost:3000/api/mcp`. Configure your AI agent:

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

Four tools available:

| Tool | Description |
|---|---|
| `explain_failure` | Decode a transaction error: program, instruction, error code, likely cause |
| `analyze_transaction` | Full analysis: CPI tree, compute profile, step-by-step timeline |
| `list_protocols` | List all supported protocols and their decoders |
| `get_recent_failures` | Recent failures across the network (configurable program filter) |

## Architecture

```
sortie-app-v2/
├── app/
│   ├── page.tsx                     # Live failure feed (home)
│   ├── tx/[signature]/page.tsx      # Transaction detail (5 tabs)
│   ├── mcp-demo/page.tsx            # MCP playground
│   └── api/
│       ├── mcp/route.ts             # MCP HTTP server
│       ├── recent-failures/route.ts # Live failure sampler
│       └── transaction/[signature]/ # Transaction fetcher
├── components/                      # Reusable UI primitives
│   ├── CpiFlow.tsx                  # React Flow tree visualization
│   ├── ExecutionTimeline.tsx        # Step-by-step walk
│   ├── ComputeProfiler.tsx          # CU breakdown
│   ├── FailureAnalysis.tsx          # Auto-categorized errors
│   ├── RecentFailures.tsx           # Live feed component
│   ├── CopyButton.tsx               # One-click clipboard
│   └── ThemeToggle.tsx              # Light/dark
├── lib/
│   ├── ir/                          # Intermediate representation
│   │   ├── types.ts                 # ExecutionStep, Action, etc.
│   │   └── builder.ts                # Parse raw tx → IR
│   ├── parser/                      # Solana-specific parsers
│   │   ├── transaction.ts           # Main entry point
│   │   ├── instructions.ts          # Instruction decoding
│   │   ├── errors.ts                # Error code → human readable
│   │   ├── logs.ts                  # Program log parsing
│   │   ├── balances.ts              # Balance change extraction
│   │   └── protocols/               # Per-program decoders
│   └── utils.ts                     # Address shortening, etc.
├── public/                          # Static assets
└── tailwind.config.ts               # Design tokens
```

### The data flow

```
Public RPC → Solana transaction → lib/parser/transaction.ts
  ↓
Intermediate Representation (IR): tree of ExecutionSteps
  ↓
Components render the IR:
  - CpiFlow: the call tree (React Flow)
  - ExecutionTimeline: chronological steps
  - ComputeProfiler: CU breakdown
  - FailureAnalysis: error categorization
```

The IR is the key abstraction. The same IR drives all four views. Add a new program decoder → it automatically works in every view.

### Adding a new program decoder

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
      // ...
    };
    return errors[code] ?? `Unknown error: 0x${code.toString(16)}`;
  },
  decodeInstruction: (data: Buffer) => {
    // parse the instruction data
    return { type: 'swap', params: { ... } };
  },
};
```

Register it in `lib/parser/protocols/index.ts`. It shows up in the live feed, the failure decoder, the timeline — everywhere.

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, TypeScript 5
- **Styling:** Tailwind CSS 3 with custom design tokens (CSS variables for theming)
- **Visualization:** React Flow (CPI tree), custom canvas components
- **Icons:** Lucide React
- **Data:** Public Solana RPC (no API key required for read-only calls)
- **MCP:** Hand-rolled JSON-RPC 2.0 server (no SDK — small surface, full control)

## API reference

### `GET /api/transaction/[signature]?network=mainnet`

Fetches and parses a transaction.

**Response:**

```json
{
  "signature": "5xYz...",
  "slot": 234567890,
  "blockTime": 1700000000,
  "fee": 5000,
  "status": "failed",
  "error": {
    "program": "Jupiter",
    "instruction": "route",
    "code": 0,
    "message": "Slippage tolerance exceeded"
  },
  "steps": [
    {
      "id": "1",
      "program": "ComputeBudget",
      "instruction": "setComputeUnitLimit",
      "depth": 0,
      "computeUnits": 200,
      "result": "success",
      "children": []
    },
    // ...
  ]
}
```

### `GET /api/recent-failures?programs=jupiter,raydium&limit=10`

Returns recent failed transactions for the given programs.

### `POST /api/mcp`

MCP JSON-RPC 2.0 endpoint. See the [MCP playground](http://localhost:3000/mcp-demo) for examples.

## Supported programs

12+ protocols decoded, more added regularly:

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

Open an issue or PR to add more.

## Development

```bash
# Install deps
npm install

# Dev server
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Start production server
npm start
```

### Project conventions

- **TypeScript strict mode** — `tsconfig.json` has `"strict": true`. No `any` in committed code.
- **Server components by default** — only mark `'use client'` when you need state, effects, or browser APIs.
- **Design tokens via CSS variables** — colors are in `:root` in `app/globals.css`, exposed via `tailwind.config.ts`. Theme switching works without re-renders.
- **No external state library** — local state, URL state, server state via fetch. Add Zustand/Redux only if you actually need it.
- **Public RPC by default** — no API key needed for read-only calls. For production, switch to Helius/QuickNode.

## Deployment

Deploys to Vercel with zero config:

```bash
# First time
vercel

# Subsequent deploys
vercel --prod
```

Or any Next.js-compatible host. The MCP endpoint is a standard Next.js API route — works on Vercel, Netlify, Cloudflare Pages, your own Node server.

**Environment variables:** none required for the public RPC. If you want a private RPC:

```bash
# .env.local
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

Then update `lib/parser/transaction.ts` to use it.

## Performance

- Transaction parsing: **< 50ms** for typical transactions (10-20 instructions)
- CPI tree render: **< 100ms** for trees up to ~100 nodes
- Live failure feed: **15s** refresh interval, **4 RPC calls/min** (well under public RPC limits)
- MCP server: **stateless, ~2s** for a full `analyze_transaction` call

## Roadmap

- [ ] **Helius support** — private RPC, transaction webhooks, faster parsing
- [ ] **Transaction replay** — fetch a transaction, modify one input, simulate
- [ ] **Anchor IDL integration** — auto-decode custom programs from IDL files
- [ ] **Compute optimization suggestions** — ML-based, learn from patterns
- [ ] **CLI** — `npx sortie <signature>` for terminal-based debugging
- [ ] **VS Code extension** — debug transactions inline

## Contributing

PRs welcome. For major changes (new program decoders, new visualizations), open an issue first.

```bash
# Fork, clone, branch
git checkout -b feat/my-decoder

# Make changes, add a decoder
# Test locally
npm run dev
# Try a real transaction

# Commit, push, PR
git commit -m "feat: add Phoenix DEX decoder"
git push origin feat/my-decoder
```

## License

MIT. See [LICENSE](LICENSE).

## Acknowledgments

- [Solana](https://solana.com) — for the chain
- [React Flow](https://reactflow.dev) — for the tree visualization
- [Anza](https://anza.xyz) (formerly Solana Labs) — for the RPC and tooling
- The Solana developer community — for the bug reports and feedback

## Contact

- GitHub: [@srivtx](https://github.com/srivtx)
- Issues: [github.com/srivtx/sortie/issues](https://github.com/srivtx/sortie/issues)
- Live demo: [sortie-six.vercel.app](https://sortie-six.vercel.app)

---

<div align="center">

Built for the [Superteam Earn](https://superteam.fun) "Ship useful agent skills" bounty.

**[Try it →](https://sortie-six.vercel.app)**

</div>
