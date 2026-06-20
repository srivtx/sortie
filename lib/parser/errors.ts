/**
 * Hardened error decoder with expanded registries.
 * Handles real-world failure patterns.
 */

import { DecodedError } from '../types';

// System program error codes (0-17)
const SYSTEM_ERRORS: Record<number, { name: string; message: string; explanation: string; suggestion?: string }> = {
  0: { name: 'AccountAlreadyInUse', message: 'Account already in use', explanation: 'The account address is already taken.', suggestion: 'Use a different account address.' },
  1: { name: 'ResultWithNegativeLamports', message: 'Negative balance', explanation: 'The transaction would result in a negative balance.', suggestion: 'Ensure the source account has sufficient funds.' },
  2: { name: 'InvalidProgramId', message: 'Invalid program ID', explanation: 'The program ID in the instruction is incorrect.' },
  3: { name: 'InvalidAccountData', message: 'Invalid account data', explanation: 'Account data does not match expected format.' },
  4: { name: 'AccountDataTooSmall', message: 'Account data too small', explanation: 'Account data size is insufficient for the operation.' },
  5: { name: 'InsufficientFunds', message: 'Insufficient lamports', explanation: 'The account does not have enough SOL.', suggestion: 'Fund the account before retrying.' },
  6: { name: 'IncorrectProgramId', message: 'Incorrect program ID', explanation: 'An account is owned by an unexpected program.' },
};

// Token program error codes
const TOKEN_ERRORS: Record<number, { name: string; message: string; explanation: string; suggestion?: string }> = {
  0: { name: 'NotRentExempt', message: 'Not rent exempt', explanation: 'Account must be rent exempt.' },
  1: { name: 'InsufficientFunds', message: 'Insufficient funds', explanation: 'The account does not have enough tokens.', suggestion: 'Ensure the token account has sufficient balance.' },
  2: { name: 'InvalidMint', message: 'Invalid mint', explanation: 'The mint account is invalid.' },
  3: { name: 'MintMismatch', message: 'Mint mismatch', explanation: 'Token accounts have different mints.' },
  4: { name: 'OwnerMismatch', message: 'Owner mismatch', explanation: 'The owner does not match.' },
  12: { name: 'AccountFrozen', message: 'Account is frozen', explanation: 'The token account is frozen and cannot be used.' },
  17: { name: 'OwnerMismatch', message: 'Owner mismatch', explanation: 'The owner does not match the expected owner.' },
};

// Jupiter error codes (Anchor style: 6000+)
const JUPITER_ERRORS: Record<number, { name: string; message: string; explanation: string; suggestion?: string }> = {
  6000: { name: 'EmptyRoute', message: 'Empty route', explanation: 'No valid swap route found.', suggestion: 'Try a different token pair or DEX.' },
  6001: { name: 'SlippageToleranceExceeded', message: 'Slippage tolerance exceeded', explanation: 'The price moved beyond the configured slippage tolerance.', suggestion: 'Increase slippage tolerance or split into smaller swaps.' },
  6002: { name: 'InvalidCalculation', message: 'Invalid calculation', explanation: 'Swap calculation produced an invalid result.', suggestion: 'Try a different amount or DEX.' },
  6003: { name: 'MissingPlatformFeeAccount', message: 'Missing platform fee account', explanation: 'Required platform fee account is missing.' },
  6004: { name: 'InvalidSlippage', message: 'Invalid slippage', explanation: 'Slippage parameter is invalid.', suggestion: 'Use a slippage value between 0 and 10000 basis points.' },
};

// Meteora / DLMM common errors
const METEORA_ERRORS: Record<number, { name: string; message: string; explanation: string }> = {
  6020: { name: 'SlippageExceeded', message: 'Slippage exceeded', explanation: 'Price moved beyond allowed slippage.' },
  6021: { name: 'InsufficientLiquidity', message: 'Insufficient liquidity', explanation: 'Not enough liquidity in the pool.' },
};

// Raydium AMM common errors
const RAYDIUM_ERRORS: Record<number, { name: string; message: string; explanation: string }> = {
  0: { name: 'InsufficientFunds', message: 'Insufficient funds', explanation: 'Not enough tokens for the swap.' },
  1: { name: 'SlippageExceeded', message: 'Slippage exceeded', explanation: 'Price moved beyond allowed slippage.' },
};

// Pump.fun error codes
const PUMP_ERRORS: Record<number, { name: string; message: string; explanation: string }> = {
  6000: { name: 'NotAuthorized', message: 'Not authorized', explanation: 'Signer is not authorized for this operation.' },
  6001: { name: 'InsufficientFunds', message: 'Insufficient funds', explanation: 'Not enough SOL for the operation.' },
  6002: { name: 'InvalidAmount', message: 'Invalid amount', explanation: 'The amount specified is invalid.' },
  6003: { name: 'SlippageExceeded', message: 'Slippage exceeded', explanation: 'Price moved beyond allowed slippage.' },
};

// Program ID to error registry
const ERROR_REGISTRIES: Record<string, Record<number, { name: string; message: string; explanation: string; suggestion?: string }>> = {
  '11111111111111111111111111111111': SYSTEM_ERRORS,
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: TOKEN_ERRORS,
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: TOKEN_ERRORS,
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': JUPITER_ERRORS,
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': RAYDIUM_ERRORS,
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': PUMP_ERRORS,
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': METEORA_ERRORS,
};

export function decodeError(
  err: any,
  accountKeys: string[],
  instructions: any[]
): DecodedError | null {
  if (!err) return null;

  // Extract InstructionError
  if (err.InstructionError) {
    const [instructionIndex, errorDetail] = err.InstructionError;
    const programId = getProgramIdFromInstruction(instructions, instructionIndex, accountKeys);
    const registry = ERROR_REGISTRIES[programId];

    let code = -1;
    let errorName = 'Unknown';
    let errorMessage = 'Unknown error';

    if (typeof errorDetail === 'string') {
      errorName = errorDetail;
      errorMessage = errorDetail;
    } else if (errorDetail && typeof errorDetail === 'object') {
      if (errorDetail.Custom !== undefined) {
        code = errorDetail.Custom;
        if (registry && registry[code]) {
          const entry = registry[code];
          return {
            programId,
            programName: getProgramName(programId),
            code,
            name: entry.name,
            message: entry.message,
            severity: 'critical',
            explanation: entry.explanation,
            suggestion: entry.suggestion,
          };
        }
        errorMessage = `Custom error: ${code}`;
      } else if (errorDetail.BorshIoError) {
        errorMessage = `Serialization error: ${errorDetail.BorshIoError}`;
      }
    }

    return {
      programId,
      programName: getProgramName(programId),
      code,
      name: errorName,
      message: errorMessage,
      severity: 'critical',
      explanation: `Error in instruction ${instructionIndex} of ${getProgramName(programId)}: ${errorMessage}`,
    };
  }

  // Other error types
  if (err.AccountInUse) {
    return {
      programId: '',
      programName: 'System',
      code: -1,
      name: 'AccountInUse',
      message: 'Account in use',
      severity: 'critical',
      explanation: `Account ${err.AccountInUse} is already in use.`,
      suggestion: 'Wait for the transaction to complete or use a different account.',
    };
  }

  if (err.BlockhashNotFound) {
    return {
      programId: '',
      programName: 'System',
      code: -1,
      name: 'BlockhashNotFound',
      message: 'Blockhash not found',
      severity: 'critical',
      explanation: 'The transaction blockhash is expired or invalid.',
      suggestion: 'Retry the transaction with a fresh blockhash.',
    };
  }

  return {
    programId: '',
    programName: 'Unknown',
    code: -1,
    name: 'UnknownError',
    message: JSON.stringify(err),
    severity: 'critical',
    explanation: 'An unknown error occurred.',
  };
}

function getProgramIdFromInstruction(
  instructions: any[],
  index: number,
  accountKeys: string[]
): string {
  if (index >= 0 && index < instructions.length) {
    const ix = instructions[index];
    if (ix.programId) return ix.programId;
    if (ix.programIdIndex !== undefined) {
      const key = accountKeys[ix.programIdIndex];
      if (typeof key === 'string') return key;
      if (typeof key === 'object' && key !== null) return (key as any).pubkey || 'unknown';
    }
  }
  return 'unknown';
}

function getProgramName(programId: string): string {
  const names: Record<string, string> = {
    '11111111111111111111111111111111': 'System Program',
    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
    TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'pump.fun',
  };
  return names[programId] || programId.slice(0, 8) + '...';
}
