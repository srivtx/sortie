import { ParsedInstruction } from '../types';

// Program ID to adapter mapping
const DECODERS: Record<string, (data: string, accounts: string[]) => Partial<ParsedInstruction> | null> = {
  '11111111111111111111111111111111': decodeSystemInstruction,
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: decodeTokenInstruction,
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: decodeTokenInstruction,
  ComputeBudget111111111111111111111111111111: decodeComputeBudgetInstruction,
};

export function decodeInstruction(
  programId: string,
  data: string,
  accounts: string[]
): { type: string; description: string; params: Record<string, any> } | null {
  const decoder = DECODERS[programId];
  if (!decoder) return null;

  try {
    const result = decoder(data, accounts);
    if (!result) return null;

    return {
      type: result.type || 'Unknown',
      description: result.description || 'Unknown instruction',
      params: result.params || {},
    };
  } catch {
    return null;
  }
}

function decodeSystemInstruction(data: string, accounts: string[]): Partial<ParsedInstruction> | null {
  // System program instructions are simple
  // data[0] = instruction type
  if (data.length < 2) return null;

  const type = data.charCodeAt(0);

  switch (type) {
    case 2: // Transfer
      return {
        type: 'Transfer',
        description: `Transfer SOL to ${shorten(accounts[1] || '')}`,
        params: { from: accounts[0], to: accounts[1] },
      };
    case 0: // CreateAccount
      return {
        type: 'CreateAccount',
        description: `Create account ${shorten(accounts[1] || '')}`,
        params: { payer: accounts[0], newAccount: accounts[1], owner: accounts[2] },
      };
    default:
      return { type: `System(${type})`, description: `System instruction ${type}`, params: {} };
  }
}

function decodeTokenInstruction(data: string, accounts: string[]): Partial<ParsedInstruction> | null {
  if (data.length < 2) return null;

  const type = data.charCodeAt(0);

  switch (type) {
    case 3: // Transfer
      return {
        type: 'Transfer',
        description: `Transfer tokens`,
        params: { from: accounts[0], to: accounts[1], owner: accounts[2] },
      };
    case 7: // MintTo
      return {
        type: 'MintTo',
        description: `Mint tokens`,
        params: { mint: accounts[0], destination: accounts[1], authority: accounts[2] },
      };
    case 9: // CloseAccount
      return {
        type: 'CloseAccount',
        description: `Close token account`,
        params: { account: accounts[0], destination: accounts[1], owner: accounts[2] },
      };
    default:
      return { type: `Token(${type})`, description: `Token instruction ${type}`, params: {} };
  }
}

function decodeComputeBudgetInstruction(data: string, accounts: string[]): Partial<ParsedInstruction> | null {
  if (data.length < 2) return null;

  const type = data.charCodeAt(0);

  switch (type) {
    case 0: // RequestUnits (deprecated)
      return { type: 'RequestUnits', description: 'Request compute units (deprecated)', params: {} };
    case 1: // RequestHeapFrame
      return { type: 'RequestHeapFrame', description: 'Request heap frame', params: {} };
    case 2: // SetComputeUnitLimit
      return { type: 'SetComputeUnitLimit', description: 'Set compute unit limit', params: {} };
    case 3: // SetComputeUnitPrice
      return { type: 'SetComputeUnitPrice', description: 'Set priority fee', params: {} };
    default:
      return { type: `ComputeBudget(${type})`, description: `Compute budget instruction ${type}`, params: {} };
  }
}

function shorten(pubkey: string): string {
  if (!pubkey || pubkey.length < 8) return pubkey;
  return pubkey.slice(0, 4) + '...' + pubkey.slice(-4);
}
