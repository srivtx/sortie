/**
 * Protocol Detection and Enrichment
 * 
 * Detects which DeFi protocols are used in a transaction and enriches
 * instructions with protocol-specific semantic understanding.
 */

import { ProtocolInfo, InstructionInfo } from '../../ir/types';

const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const RAYDIUM_AMM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const RAYDIUM_CLMM_PROGRAM_ID = 'CAMMCzo5YL8w4VzRFKYdqVBVsMS92KhL9YfYRcB9mP3';
const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const ORCA_WHIRLPOOL_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZh8DMvmN7VMR8eN';
const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

export function detectProtocol(programId: string, instruction: InstructionInfo): ProtocolInfo | null {
  switch (programId) {
    case JUPITER_PROGRAM_ID:
      return {
        name: 'Jupiter',
        programId,
        category: 'dex',
        semanticSummary: detectJupiterAction(instruction),
      };
    case RAYDIUM_AMM_PROGRAM_ID:
    case RAYDIUM_CLMM_PROGRAM_ID:
      return {
        name: 'Raydium',
        programId,
        category: 'dex',
        semanticSummary: detectRaydiumAction(instruction),
      };
    case PUMP_FUN_PROGRAM_ID:
      return {
        name: 'pump.fun',
        programId,
        category: 'launchpad',
        semanticSummary: detectPumpFunAction(instruction),
      };
    case ORCA_WHIRLPOOL_PROGRAM_ID:
      return {
        name: 'Orca',
        programId,
        category: 'dex',
        semanticSummary: detectOrcaAction(instruction),
      };
    case METEORA_DLMM_PROGRAM_ID:
      return {
        name: 'Meteora',
        programId,
        category: 'dex',
        semanticSummary: detectMeteoraAction(instruction),
      };
    case DRIFT_PROGRAM_ID:
      return {
        name: 'Drift',
        programId,
        category: 'perps',
        semanticSummary: detectDriftAction(instruction),
      };
    default:
      return null;
  }
}

export function enrichInstruction(
  instruction: InstructionInfo,
  protocol: ProtocolInfo
): InstructionInfo {
  switch (protocol.name) {
    case 'Jupiter':
      return enrichJupiterInstruction(instruction);
    case 'Raydium':
      return enrichRaydiumInstruction(instruction);
    case 'pump.fun':
      return enrichPumpFunInstruction(instruction);
    case 'Orca':
      return enrichOrcaInstruction(instruction);
    case 'Meteora':
      return enrichMeteoraInstruction(instruction);
    case 'Drift':
      return enrichDriftInstruction(instruction);
    default:
      return instruction;
  }
}

// ============================================================================
// JUPITER
// ============================================================================

function detectJupiterAction(instruction: InstructionInfo): string {
  const type = instruction.type.toLowerCase();
  if (type.includes('route') || type.includes('swap')) {
    return 'Token swap via Jupiter aggregator';
  }
  if (type.includes('token')) {
    return 'Token operation';
  }
  return 'Jupiter DEX interaction';
}

function enrichJupiterInstruction(instruction: InstructionInfo): InstructionInfo {
  const type = instruction.type.toLowerCase();
  const accounts = instruction.accounts;
  
  // Try to extract route info from accounts
  const tokenAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes('token') || 
    a.name.toLowerCase().includes('account')
  );
  
  let semanticSummary = instruction.semanticSummary;
  
  if (type.includes('route') || type.includes('swap')) {
    const input = tokenAccounts[0];
    const output = tokenAccounts[tokenAccounts.length - 1];
    semanticSummary = `Swap via Jupiter: ${input ? input.pubkey.slice(0, 8) : '?'} → ${output ? output.pubkey.slice(0, 8) : '?'}`;
  }
  
  return {
    ...instruction,
    semanticSummary,
    description: instruction.description || `Jupiter ${instruction.type}`,
  };
}

// ============================================================================
// RAYDIUM
// ============================================================================

function detectRaydiumAction(instruction: InstructionInfo): string {
  const type = instruction.type.toLowerCase();
  if (type.includes('swap')) {
    return 'Token swap on Raydium';
  }
  if (type.includes('add') || type.includes('deposit')) {
    return 'Add liquidity to Raydium pool';
  }
  if (type.includes('remove') || type.includes('withdraw')) {
    return 'Remove liquidity from Raydium pool';
  }
  if (type.includes('initialize')) {
    return 'Initialize Raydium pool';
  }
  return 'Raydium DEX interaction';
}

function enrichRaydiumInstruction(instruction: InstructionInfo): InstructionInfo {
  const type = instruction.type.toLowerCase();
  let semanticSummary = instruction.semanticSummary;
  
  if (type.includes('swap')) {
    semanticSummary = 'Swap tokens on Raydium AMM';
  } else if (type.includes('add')) {
    semanticSummary = 'Provide liquidity to Raydium pool';
  } else if (type.includes('remove')) {
    semanticSummary = 'Withdraw liquidity from Raydium pool';
  }
  
  return {
    ...instruction,
    semanticSummary,
    description: instruction.description || `Raydium ${instruction.type}`,
  };
}

// ============================================================================
// PUMP.FUN
// ============================================================================

function detectPumpFunAction(instruction: InstructionInfo): string {
  const type = instruction.type.toLowerCase();
  const params = instruction.params;
  
  if (type.includes('buy') || params?.isBuy === true) {
    return 'Buy token on pump.fun';
  }
  if (type.includes('sell') || params?.isBuy === false) {
    return 'Sell token on pump.fun';
  }
  if (type.includes('create') || type.includes('launch')) {
    return 'Launch new token on pump.fun';
  }
  if (type.includes('setparams')) {
    return 'Set pump.fun bonding curve parameters';
  }
  return 'pump.fun interaction';
}

function enrichPumpFunInstruction(instruction: InstructionInfo): InstructionInfo {
  const type = instruction.type.toLowerCase();
  const params = instruction.params;
  let semanticSummary = instruction.semanticSummary;

  if (type.includes('buy') || params?.isBuy === true) {
    const amount = params?.tokenAmount || params?.amount || '?';
    semanticSummary = `Buy ${amount} tokens on pump.fun`;
  } else if (type.includes('sell') || params?.isBuy === false) {
    const amount = params?.tokenAmount || params?.amount || '?';
    semanticSummary = `Sell ${amount} tokens on pump.fun`;
  } else if (type.includes('create') || type.includes('launch')) {
    semanticSummary = 'Launch new token on pump.fun';
  }

  return {
    ...instruction,
    semanticSummary,
    description: instruction.description || `pump.fun ${instruction.type}`,
  };
}

// ============================================================================
// ORCA WHIRLPOOLS (CLMM)
// ============================================================================

function detectOrcaAction(instruction: InstructionInfo): string {
  const type = instruction.type.toLowerCase();
  if (type.includes('swap')) return 'Token swap on Orca Whirlpools';
  if (type.includes('openposition') || type.includes('increase')) return 'Open/increase Orca liquidity position';
  if (type.includes('decrease') || type.includes('close')) return 'Decrease/close Orca liquidity position';
  if (type.includes('initialize')) return 'Initialize Orca Whirlpool';
  if (type.includes('updatefees') || type.includes('updatereward')) return 'Update Orca pool fees/rewards';
  return 'Orca Whirlpools interaction';
}

function enrichOrcaInstruction(instruction: InstructionInfo): InstructionInfo {
  const type = instruction.type.toLowerCase();
  let semanticSummary = detectOrcaAction(instruction);
  return {
    ...instruction,
    semanticSummary,
    description: instruction.description || `Orca ${instruction.type}`,
  };
}

// ============================================================================
// METEORA DLMM
// ============================================================================

function detectMeteoraAction(instruction: InstructionInfo): string {
  const type = instruction.type.toLowerCase();
  if (type.includes('swap')) return 'Token swap on Meteora DLMM';
  if (type.includes('addliquidity')) return 'Add liquidity to Meteora DLMM bin';
  if (type.includes('removeliquidity')) return 'Remove liquidity from Meteora DLMM bin';
  if (type.includes('initialize')) return 'Initialize Meteora DLMM pool/bin';
  if (type.includes('claimfee') || type.includes('withdraw')) return 'Claim fees from Meteora DLMM';
  return 'Meteora DLMM interaction';
}

function enrichMeteoraInstruction(instruction: InstructionInfo): InstructionInfo {
  const type = instruction.type.toLowerCase();
  let semanticSummary = detectMeteoraAction(instruction);
  return {
    ...instruction,
    semanticSummary,
    description: instruction.description || `Meteora ${instruction.type}`,
  };
}

// ============================================================================
// DRIFT PROTOCOL (perps)
// ============================================================================

function detectDriftAction(instruction: InstructionInfo): string {
  const type = instruction.type.toLowerCase();
  if (type.includes('placeorder') || type.includes('placeperp') || type.includes('orders')) {
    return 'Place Drift perpetual order';
  }
  if (type.includes('cancelorder')) return 'Cancel Drift order';
  if (type.includes('deposit') || type.includes('addcollateral')) {
    return 'Deposit collateral to Drift';
  }
  if (type.includes('withdraw') || type.includes('removecollateral')) {
    return 'Withdraw collateral from Drift';
  }
  if (type.includes('liquidate')) return 'Drift liquidation';
  if (type.includes('settlepnl') || type.includes('settle')) return 'Settle Drift PnL';
  if (type.includes('openposition') || type.includes('increaseliquidity')) {
    return 'Open/increase Drift position';
  }
  if (type.includes('reduceliquidity') || type.includes('closeposition')) {
    return 'Reduce/close Drift position';
  }
  return 'Drift perpetual interaction';
}

function enrichDriftInstruction(instruction: InstructionInfo): InstructionInfo {
  const type = instruction.type.toLowerCase();
  let semanticSummary = detectDriftAction(instruction);
  return {
    ...instruction,
    semanticSummary,
    description: instruction.description || `Drift ${instruction.type}`,
  };
}
