import { NextRequest, NextResponse } from 'next/server';
import { buildExecutionIR } from '@/lib/ir/builder';
import { isValidSignature } from '@/lib/utils';

const NETWORKS: Record<string, string> = {
  mainnet: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  devnet: process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com',
  testnet: process.env.SOLANA_TESTNET_RPC_URL || 'https://api.testnet.solana.com',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { signature: string } }
) {
  const { signature } = params;
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network') || 'mainnet';

  if (!isValidSignature(signature)) {
    return NextResponse.json(
      { error: 'Invalid transaction signature format' },
      { status: 400 }
    );
  }

  const rpcUrl = NETWORKS[network];
  if (!rpcUrl) {
    return NextResponse.json(
      { error: `Unknown network: ${network}. Supported: mainnet, devnet, testnet` },
      { status: 400 }
    );
  }

  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed',
          },
        ],
      }),
    });

    if (!rpcResponse.ok) {
      throw new Error(`RPC error: ${rpcResponse.status}`);
    }

    const data = await rpcResponse.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || 'RPC error' },
        { status: 400 }
      );
    }

    if (!data.result) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const ir = buildExecutionIR(signature, data.result);

    return NextResponse.json(ir);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}
