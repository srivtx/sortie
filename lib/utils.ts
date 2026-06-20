/**
 * Utility functions for SORTIE DevTools
 */

export function shorten(pubkey: string, chars = 4): string {
  if (!pubkey || pubkey.length < chars * 2 + 3) return pubkey;
  return pubkey.slice(0, chars) + '...' + pubkey.slice(-chars);
}

export function formatLamports(lamports: number): string {
  if (lamports === 0) return '0 SOL';
  if (lamports < 1000) return `${lamports} lamports`;
  return `${(lamports / 1e9).toFixed(9)} SOL`;
}

export function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp * 1000).toLocaleString();
}

export function formatSlot(slot: number): string {
  return slot.toLocaleString();
}

export function isValidSignature(signature: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature);
}

const KNOWN_PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111': 'System Program',
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: 'Associated Token Account',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: 'Orca Whirlpool',
  ComputeBudget111111111111111111111111111111: 'Compute Budget',
  AddressLookupTab1e1111111111111111111111111: 'Address Lookup Table',
};

export function getProgramName(programId: string): string {
  return KNOWN_PROGRAMS[programId] || programId;
}

export function getProgramShortName(programId: string): string {
  return KNOWN_PROGRAMS[programId] || shorten(programId, 6);
}
