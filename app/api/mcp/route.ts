/**
 * SORTIE DevTools — MCP HTTP Server
 *
 * Exposes SORTIE's transaction analysis capabilities to AI agents via the
 * Model Context Protocol (MCP) over HTTP/JSON-RPC 2.0 transport.
 *
 * Endpoints:
 *   POST /api/mcp   — JSON-RPC 2.0 envelope
 *
 * Methods supported:
 *   - initialize         (MCP handshake)
 *   - tools/list         (returns the tool catalog)
 *   - tools/call         (invokes a tool)
 *   - ping               (health check)
 *
 * Tools:
 *   - analyze_transaction(signature, network?)
 *   - explain_failure(signature, network?)
 *   - list_protocols()
 *   - get_recent_failures(limit?)
 *
 * Tested with: curl -X POST http://localhost:3001/api/mcp -d '...'
 *             See README in app/mcp-demo/page.tsx for a browser UI.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NETWORKS: Record<string, string> = {
  mainnet: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  devnet: process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com',
  testnet: process.env.SOLANA_TESTNET_RPC_URL || 'https://api.testnet.solana.com',
};

const TOOLS = [
  {
    name: 'analyze_transaction',
    description:
      'Fetch a Solana transaction and return its full semantic execution IR — programs invoked, CPI tree, compute consumed per step, balance changes, protocol detection, and structured failure analysis. Use this to understand any Solana transaction.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: {
          type: 'string',
          description: 'Solana transaction signature (base58, 87-88 chars)',
        },
        network: {
          type: 'string',
          enum: ['mainnet', 'devnet', 'testnet'],
          description: 'Solana network. Defaults to mainnet.',
        },
      },
      required: ['signature'],
    },
  },
  {
    name: 'explain_failure',
    description:
      'Fetch a Solana transaction and return only the human-readable failure analysis — category (insufficient funds, slippage, compute exceeded, etc.), explanation, probable cause, and actionable fix. Use this when you only need the "why did it fail" answer.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: {
          type: 'string',
          description: 'Solana transaction signature (base58)',
        },
        network: {
          type: 'string',
          enum: ['mainnet', 'devnet', 'testnet'],
          description: 'Solana network. Defaults to mainnet.',
        },
      },
      required: ['signature'],
    },
  },
  {
    name: 'list_protocols',
    description:
      'Return the list of Solana DeFi protocols SORTIE has first-class semantic adapters for (e.g. Jupiter, Raydium, Orca, Meteora, Drift, pump.fun). Each adapter enriches transaction instructions with protocol-specific context.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_recent_failures',
    description:
      'Return a list of recent failed Solana transactions sampled from high-volume programs (Jupiter, Raydium, Orca, SPL Token). Each entry includes the signature, program that failed, error code, slot, and timestamp. Useful for live debugging and "what is breaking right now" feeds.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of failures to return. Defaults to 10, max 50.',
          minimum: 1,
          maximum: 50,
        },
      },
    },
  },
];

const POPULAR_PROGRAMS = [
  { id: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', name: 'Jupiter' },
  { id: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', name: 'Raydium AMM' },
  { id: 'CAMMCzo5YL8w4VzRFKYdqVBVsMS92KhL9YfYRcB9mP3', name: 'Raydium CLMM' },
  { id: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', name: 'Orca Whirlpools' },
  { id: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZh8DMvmN7VMR8eN', name: 'Meteora DLMM' },
  { id: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', name: 'Drift Protocol' },
  { id: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', name: 'pump.fun' },
  { id: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', name: 'SPL Token' },
];

async function rpcCall(rpcUrl: string, method: string, params: any): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`RPC ${method} failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC ${method} error: ${data.error.message || 'unknown'}`);
  }
  return data.result;
}

function getOrigin(request: NextRequest): string {
  return request.nextUrl.origin;
}

async function buildTransactionUrl(request: NextRequest, signature: string, network: string): Promise<string> {
  return `${getOrigin(request)}/tx/${signature}?network=${network}`;
}

async function toolAnalyzeTransaction(args: any, request: NextRequest) {
  const signature = args.signature;
  const network = args.network || 'mainnet';
  const rpcUrl = NETWORKS[network];
  if (!rpcUrl) {
    throw new Error(`Unknown network: ${network}`);
  }
  try {
    const result = await rpcCall(rpcUrl, 'getTransaction', [
      signature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ]);
    const baseUrl = await buildTransactionUrl(request, signature, network);
    return {
      signature,
      network,
      analyzeUrl: baseUrl,
      transaction: result,
    };
  } catch (e: any) {
    throw new Error(`Failed to fetch transaction: ${e.message}`);
  }
}

async function toolExplainFailure(args: any, request: NextRequest) {
  const signature = args.signature;
  const network = args.network || 'mainnet';
  const rpcUrl = NETWORKS[network];
  if (!rpcUrl) {
    throw new Error(`Unknown network: ${network}`);
  }
  const baseUrl = `${getOrigin(request)}/api/transaction/${signature}?network=${network}`;
  const analyzeUrl = await buildTransactionUrl(request, signature, network);
  try {
    const res = await fetch(baseUrl, { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed: HTTP ${res.status}`);
    }
    const ir = await res.json();
    if (ir.success) {
      return [
        {
          type: 'text',
          text:
            `Transaction ${signature} SUCCEEDED.\n\n` +
            `Protocols: ${ir.protocols?.map((p: any) => p.name).join(', ') || 'none detected'}\n` +
            `Steps: ${ir.allSteps?.length || 0} (${ir.steps?.length || 0} root)\n` +
            `Compute: ${ir.compute?.consumed?.toLocaleString() || '?'} CUs\n` +
            `Fee: ${ir.fee?.total?.toLocaleString() || '?'} lamports\n` +
            `Slot: ${ir.slot?.toLocaleString()}\n\n` +
            `View full analysis: ${analyzeUrl}`,
        },
      ];
    }
    const f = ir.failure;
    if (!f) {
      return [
        { type: 'text', text: `Transaction ${signature} failed but no structured failure was detected. Raw error: ${JSON.stringify(ir.compute)}. View: ${analyzeUrl}` },
      ];
    }
    const ctx = f.analysis?.context || {};
    const ctxLines: string[] = [];
    if (ctx.feePayerLowBalance) ctxLines.push('- Fee payer has insufficient balance');
    if (ctx.computeExceeded) ctxLines.push('- Compute budget was exceeded');
    if (ctx.missingTokenAccounts?.length) ctxLines.push(`- Missing token accounts: ${ctx.missingTokenAccounts.join(', ')}`);
    const text =
      `Transaction ${signature} FAILED.\n\n` +
      `Category: ${f.analysis?.category || 'unknown'}\n` +
      `Severity: ${f.analysis?.severity || 'unknown'}\n` +
      `Program: ${f.failingStep?.program?.shortName || f.failingStep?.program?.id?.slice(0, 8) || 'unknown'}\n` +
      `Error: ${f.error?.name || 'unknown'} (${f.error?.code || '?'})\n` +
      `Raw: ${f.error?.rawMessage || ''}\n\n` +
      `Why: ${f.analysis?.explanation || 'no explanation available'}\n` +
      `Likely cause: ${f.analysis?.probableCause || 'unknown'}\n` +
      `Fix: ${f.analysis?.fixSuggestion || 'no suggestion available'}\n` +
      (ctxLines.length ? `\nContext:\n${ctxLines.join('\n')}\n` : '') +
      `\nView full analysis: ${analyzeUrl}`;
    return [{ type: 'text', text }];
  } catch (e: any) {
    throw new Error(`Failed to explain: ${e.message}`);
  }
}

function toolListProtocols() {
  return POPULAR_PROGRAMS.map((p) => ({
    id: p.id,
    name: p.name,
    note: 'SORTIE detects this program and enriches its instructions with protocol-specific semantic summaries.',
  }));
}

async function toolGetRecentFailures(args: any) {
  const limit = Math.min(Math.max(parseInt(args.limit || '10') || 10, 1), 50);
  const failures: any[] = [];
  for (const program of POPULAR_PROGRAMS.slice(0, 4)) {
    if (failures.length >= limit) break;
    try {
      const sigs: any[] = await rpcCall(NETWORKS.mainnet, 'getSignaturesForAddress', [
        program.id,
        { limit: 25 },
      ]);
      for (const sigInfo of sigs) {
        if (failures.length >= limit) break;
        if (sigInfo.err) {
          failures.push({
            signature: sigInfo.signature,
            program: program.id,
            programName: program.name,
            error: JSON.stringify(sigInfo.err).slice(0, 200),
            slot: sigInfo.slot,
            blockTime: sigInfo.blockTime,
          });
        }
      }
    } catch (e) {
      // skip this program on error
    }
  }
  failures.sort((a, b) => (b.slot || 0) - (a.slot || 0));
  return failures.slice(0, limit);
}

function jsonRpcError(id: any, code: number, message: string, data?: any) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

function jsonRpcResult(id: any, result: any) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, 'Parse error'));
  }
  const { jsonrpc, id, method, params } = body;
  if (jsonrpc !== '2.0') {
    return NextResponse.json(jsonRpcError(id, -32600, 'Invalid Request: jsonrpc must be 2.0'));
  }
  try {
    if (method === 'initialize') {
      return NextResponse.json(jsonRpcResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'sortie-devtools-mcp', version: '0.1.0' },
      }));
    }
    if (method === 'ping') {
      return NextResponse.json(jsonRpcResult(id, {}));
    }
    if (method === 'tools/list') {
      return NextResponse.json(jsonRpcResult(id, { tools: TOOLS }));
    }
    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params || {};
      let result: any;
      if (name === 'analyze_transaction') {
        result = await toolAnalyzeTransaction(args, request);
      } else if (name === 'explain_failure') {
        result = await toolExplainFailure(args, request);
      } else if (name === 'list_protocols') {
        result = toolListProtocols();
      } else if (name === 'get_recent_failures') {
        result = await toolGetRecentFailures(args);
      } else {
        return NextResponse.json(jsonRpcError(id, -32601, `Method not found: ${name}`));
      }
      // MCP requires content array. Wrap any non-content-array result.
      let content: any[];
      if (Array.isArray(result) && result.length > 0 && result[0]?.type) {
        content = result; // already MCP-shaped (from explain_failure)
      } else {
        content = [{ type: 'text', text: JSON.stringify(result, null, 2) }];
      }
      return NextResponse.json(jsonRpcResult(id, { content, isError: false }));
    }
    return NextResponse.json(jsonRpcError(id, -32601, `Method not found: ${method}`));
  } catch (e: any) {
    return NextResponse.json(jsonRpcError(id, -32603, `Internal error: ${e.message}`));
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'sortie-devtools-mcp',
    version: '0.1.0',
    description: 'MCP HTTP server for SORTIE DevTools — Solana transaction analysis for AI agents',
    endpoint: 'POST /api/mcp',
    transport: 'http (JSON-RPC 2.0)',
    methods: ['initialize', 'ping', 'tools/list', 'tools/call'],
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description.split('.')[0] })),
    quickStart: {
      listTools: 'curl -X POST http://localhost:3001/api/mcp -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\'',
      callTool:
        'curl -X POST http://localhost:3001/api/mcp -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"explain_failure","arguments":{"signature":"<SIG>"}}}\'',
    },
  });
}
