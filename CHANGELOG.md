# Changelog

All notable changes to SORTIE are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/), and this project
adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-06-20

### Added

- Failure decoder for 12+ Solana programs (Jupiter, Raydium, Orca,
  Drift, Meteora, Kamino, Mango, Marinade, Sanctum, SPL Token, System
  Program, Associated Token)
- CPI tree visualization (React Flow) with drag-to-explore
- Execution timeline with step-by-step walk
- Compute profiler with CU breakdown and hot spots
- Failure analysis with auto-categorization (severity, cause, fix)
- Live failure feed (15s refresh, public RPC, no API key required)
- MCP HTTP server at `/api/mcp` (JSON-RPC 2.0, no SDK)
  - `explain_failure`
  - `analyze_transaction`
  - `list_protocols`
  - `get_recent_failures`
- MCP playground at `/mcp-demo` (try each tool from the browser)
- Light/dark theme toggle (persisted to localStorage)
- Copy buttons (signatures, share URLs, MCP config)
- Transaction detail page with 5 tabs (timeline / tree / profile /
  logs / raw)
- Error overlay for broken transactions (renders in preview, not a
  full reload)
- Edge cache, no-flash hydration
- Responsive layout (mobile-friendly)
- Production README, CONTRIBUTING.md, MIT LICENSE

### Performance

- Transaction parsing: < 50ms for typical transactions
- CPI tree render: < 100ms for ~100 nodes
- Live feed: 4 RPC calls/min (under public RPC limits)
- MCP server: stateless, ~2s for full `analyze_transaction`

### Tech stack

- Next.js 14 (App Router)
- React 18, TypeScript 5 (strict)
- Tailwind CSS 3 with custom design tokens
- React Flow for tree visualization
- Lucide React for icons
- Hand-rolled JSON-RPC 2.0 for MCP

### Notes

This is the first public release. Submitted to the Superteam Earn
"ship useful agent skills" bounty and shipped as a standalone repo at
[srivtx/sortie](https://github.com/srivtx/sortie).

[0.1.0]: https://github.com/srivtx/sortie/releases/tag/v0.1.0
