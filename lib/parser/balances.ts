import { BalanceChange, TokenBalanceChange, RPCTokenBalance } from '../types';

export function computeBalanceChanges(
  accountKeys: string[],
  preBalances: number[],
  postBalances: number[],
  feePayer: string
): BalanceChange[] {
  const changes: BalanceChange[] = [];

  for (let i = 0; i < accountKeys.length; i++) {
    const pre = preBalances[i] || 0;
    const post = postBalances[i] || 0;
    const change = post - pre;

    if (change !== 0) {
      changes.push({
        account: accountKeys[i],
        accountIndex: i,
        pre,
        post,
        change,
        isFeePayer: accountKeys[i] === feePayer,
      });
    }
  }

  return changes;
}

export function computeTokenBalanceChanges(
  preTokenBalances: RPCTokenBalance[],
  postTokenBalances: RPCTokenBalance[],
  accountKeys: string[]
): TokenBalanceChange[] {
  const preMap = new Map(preTokenBalances.map((t) => [t.accountIndex, t]));
  const postMap = new Map(postTokenBalances.map((t) => [t.accountIndex, t]));

  const changes: TokenBalanceChange[] = [];
  const allIndices = new Set([
    ...preTokenBalances.map((t) => t.accountIndex),
    ...postTokenBalances.map((t) => t.accountIndex),
  ]);

  for (const index of Array.from(allIndices)) {
    const pre = preMap.get(index);
    const post = postMap.get(index);

    const preAmount = pre ? pre.uiTokenAmount.amount : '0';
    const postAmount = post ? post.uiTokenAmount.amount : '0';
    const preUi = pre ? pre.uiTokenAmount.uiAmount : null;
    const postUi = post ? post.uiTokenAmount.uiAmount : null;

    const changeRaw = BigInt(postAmount) - BigInt(preAmount);

    if (changeRaw !== BigInt(0)) {
      changes.push({
        account: accountKeys[index] || `account[${index}]`,
        accountIndex: index,
        mint: (post || pre)!.mint,
        owner: (post || pre)!.owner,
        pre: { raw: preAmount, ui: preUi },
        post: { raw: postAmount, ui: postUi },
        change: {
          raw: changeRaw.toString(),
          ui: postUi !== null && preUi !== null ? postUi - preUi : null,
        },
        decimals: (post || pre)!.uiTokenAmount.decimals,
      });
    }
  }

  return changes;
}
