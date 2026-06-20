import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NETWORKS: Record<string, string> = {
  mainnet: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  devnet: process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com',
  testnet: process.env.SOLANA_TESTNET_RPC_URL || 'https://api.testnet.solana.com',
};

// Popular programs to sample. High tx volume = good chance of finding failures.
const PROGRAMS = [
  { id: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', name: 'Jupiter' },
  { id: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', name: 'Raydium AMM' },
  { id: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', name: 'Orca' },
  { id: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', name: 'SPL Token' },
];

async function rpcCall(rpcUrl: string, method: string, params: any): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`RPC ${method} failed: ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC ${method} error: ${data.error.message || 'unknown'}`);
  }
  return data.result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network') || 'mainnet';
  const limit = parseInt(searchParams.get('limit') || '10');

  const rpcUrl = NETWORKS[network];
  if (!rpcUrl) {
    return NextResponse.json(
      { error: `Unknown network: ${network}` },
      { status: 400 }
    );
  }

  const failures: Array<{
    signature: string;
    slot: number;
    blockTime: number | null;
    program: string;
    programName: string;
    error: string;
  }> = [];

  try {
    for (const program of PROGRAMS) {
      if (failures.length >= limit) break;

      const sigs: any[] = await rpcCall(rpcUrl, 'getSignaturesForAddress', [
        program.id,
        { limit: 25 },
      ]);

      for (const sigInfo of sigs) {
        if (failures.length >= limit) break;
        if (sigInfo.err) {
          failures.push({
            signature: sigInfo.signature,
            slot: sigInfo.slot,
            blockTime: sigInfo.blockTime,
            program: program.id,
            programName: program.name,
            error: JSON.stringify(sigInfo.err).slice(0, 200),
          });
        }
      }
    }

    failures.sort((a, b) => (b.slot || 0) - (a.slot || 0));

    return NextResponse.json(
      { failures, count: failures.length },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recent failures' },
      { status: 500 }
    );
  }
}
