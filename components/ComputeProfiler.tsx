'use client';

import { ExecutionIR } from '@/lib/ir/types';
import { Cpu, Flame, TrendingUp, BarChart3 } from 'lucide-react';
import { useMemo } from 'react';

interface ComputeProfilerProps {
  ir: ExecutionIR;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function depthIndent(depth: number): string {
  return depth > 0 ? `${depth * 16}px` : '0';
}

export default function ComputeProfiler({ ir }: ComputeProfilerProps) {
  const analysis = useMemo(() => {
    const steps = ir.allSteps.filter(s => s.computeUnits && s.computeUnits.consumed > 0);
    const sortedByCu = [...steps].sort(
      (a, b) => (b.computeUnits?.consumed || 0) - (a.computeUnits?.consumed || 0)
    );
    const totalConsumed = ir.compute.consumed || 0;
    const accounted = steps.reduce((s, st) => s + (st.computeUnits?.consumed || 0), 0);
    const overhead = Math.max(0, totalConsumed - accounted);
    const budget = ir.compute.requestedLimit;
    const utilization = ir.compute.utilizationPercent;
    const hotSpots = sortedByCu.slice(0, 5);
    const byProgram: Record<string, { count: number; cu: number; name: string }> = {};
    for (const s of steps) {
      const pid = s.program.id;
      if (!byProgram[pid]) {
        byProgram[pid] = { count: 0, cu: 0, name: s.program.shortName || s.program.name || pid.slice(0, 8) };
      }
      byProgram[pid].count += 1;
      byProgram[pid].cu += s.computeUnits?.consumed || 0;
    }
    const programTotals = Object.values(byProgram).sort((a, b) => b.cu - a.cu);
    const maxCu = sortedByCu[0]?.computeUnits?.consumed || 1;
    return { sortedByCu, totalConsumed, accounted, overhead, budget, utilization, hotSpots, programTotals, maxCu, stepCount: steps.length };
  }, [ir]);

  const barColor = (cu: number) => {
    if (!analysis.budget) return 'bg-green';
    const pct = (cu / analysis.budget) * 100;
    if (pct > 50) return 'bg-red';
    if (pct > 20) return 'bg-amber';
    if (pct > 5) return 'bg-green';
    return 'bg-line2';
  };

  return (
    <div className="font-mono text-xs">
      <div className="text-[10px] text-mute mb-3">$ sortie profile --compute</div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Stat label="consumed" value={formatNumber(analysis.totalConsumed)} sub="compute units" />
        <Stat
          label="budget"
          value={analysis.budget ? formatNumber(analysis.budget) : '—'}
          sub={analysis.utilization !== null ? `${analysis.utilization}% used` : 'no limit requested'}
        />
        <Stat
          label="hottest"
          value={analysis.hotSpots[0] ? formatNumber(analysis.hotSpots[0].computeUnits!.consumed) : '—'}
          sub={analysis.hotSpots[0]?.program.shortName || 'no data'}
          tone="red"
        />
        <Stat
          label="steps"
          value={String(analysis.stepCount)}
          sub={analysis.overhead > 0 ? `+${formatNumber(analysis.overhead)} unaccounted` : `of ${ir.allSteps.length} total`}
        />
      </div>

      {/* Budget utilization bar */}
      {analysis.budget && (
        <div className="mb-4 border border-line rounded p-3 bg-surface">
          <div className="text-[10px] text-mute mb-1.5 uppercase tracking-wider">budget utilization</div>
          <div className="h-3 bg-bg rounded overflow-hidden">
            <div
              className={`h-full ${(analysis.utilization || 0) > 90 ? 'bg-red' : (analysis.utilization || 0) > 70 ? 'bg-amber' : 'bg-green'}`}
              style={{ width: `${Math.min(analysis.utilization || 0, 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-mute mt-1">
            {formatNumber(analysis.totalConsumed)} / {formatNumber(analysis.budget)} ({analysis.utilization}%)
          </div>
        </div>
      )}

      {/* Top hot spots */}
      <div className="mb-4">
        <div className="text-[10px] text-mute mb-2 flex items-center gap-1.5 uppercase tracking-wider">
          <Flame className="w-3 h-3 text-red" /> top compute consumers
        </div>
        <div className="space-y-1.5">
          {analysis.hotSpots.map((step, i) => {
            const cu = step.computeUnits!.consumed;
            const pctOfBudget = analysis.budget ? (cu / analysis.budget) * 100 : 0;
            const pctOfMax = (cu / analysis.maxCu) * 100;
            return (
              <div key={step.id} className="border border-line rounded p-2 bg-surface">
                <div className="flex items-center justify-between mb-1 text-[10px]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-dim2 w-4 text-right">#{i + 1}</span>
                    <span className="text-ink truncate">{step.program.shortName || step.program.name || step.program.id.slice(0, 8)}</span>
                    {step.depth > 0 && <span className="text-dim">d{step.depth}</span>}
                    {step.protocol && <span className="text-purple">· {step.protocol.name}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-ink font-semibold">{formatNumber(cu)}</span>
                    {analysis.budget && <span className="text-dim text-[10px]">({pctOfBudget.toFixed(1)}%)</span>}
                  </div>
                </div>
                <div className="h-1.5 bg-bg rounded overflow-hidden">
                  <div
                    className={`h-full ${barColor(cu)}`}
                    style={{ width: `${pctOfMax}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By program */}
      {analysis.programTotals.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-mute mb-2 uppercase tracking-wider">compute by program</div>
          <div className="border border-line rounded p-3 bg-surface space-y-2">
            {analysis.programTotals.map((p, i) => {
              const pctOfTotal = (p.cu / analysis.totalConsumed) * 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="text-ink">{p.name}</span>
                    <span className="text-dim">
                      {formatNumber(p.cu)} CU · {p.count} {p.count === 1 ? 'call' : 'calls'} · {pctOfTotal.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 bg-bg rounded overflow-hidden">
                    <div className="h-full bg-green" style={{ width: `${pctOfTotal}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full breakdown table */}
      <div>
        <div className="text-[10px] text-mute mb-2 uppercase tracking-wider">all steps (sorted by CU)</div>
        <div className="border border-line rounded bg-surface overflow-hidden">
          <table className="w-full text-[10px]">
            <thead className="bg-surface2 text-mute">
              <tr>
                <th className="text-left px-2 py-1.5 font-normal">#</th>
                <th className="text-left px-2 py-1.5 font-normal">program</th>
                <th className="text-left px-2 py-1.5 font-normal">instruction</th>
                <th className="text-right px-2 py-1.5 font-normal">CU</th>
                <th className="text-right px-2 py-1.5 font-normal">% of total</th>
                <th className="text-left px-2 py-1.5 font-normal w-1/3">bar</th>
              </tr>
            </thead>
            <tbody>
              {analysis.sortedByCu.map((step, i) => {
                const cu = step.computeUnits!.consumed;
                const pctOfTotal = (cu / analysis.totalConsumed) * 100;
                const pctOfMax = (cu / analysis.maxCu) * 100;
                return (
                  <tr key={step.id} className="border-t border-line hover:bg-surface2">
                    <td className="px-2 py-1 text-dim2">{i + 1}</td>
                    <td className="px-2 py-1" style={{ paddingLeft: `calc(0.5rem + ${depthIndent(step.depth)})` }}>
                      {step.depth > 0 && <span className="text-dim2 mr-1">└</span>}
                      {step.program.shortName || step.program.id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-1 text-dim truncate max-w-xs">
                      {step.instruction.semanticSummary || step.instruction.type}
                    </td>
                    <td className="px-2 py-1 text-right text-ink">{formatNumber(cu)}</td>
                    <td className="px-2 py-1 text-right text-dim">{pctOfTotal.toFixed(1)}%</td>
                    <td className="px-2 py-1">
                      <div className="h-1 bg-bg rounded overflow-hidden">
                        <div className={`h-full ${barColor(cu)}`} style={{ width: `${pctOfMax}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optimization hints */}
      {analysis.utilization !== null && analysis.utilization > 80 && (
        <div className="mt-4 border border-amber/30 bg-amber/5 rounded p-3 text-[10px]">
          <div className="text-amber font-semibold mb-1 uppercase tracking-wider">⚠ optimization hint</div>
          <div className="text-dim">
            This transaction is using {analysis.utilization}% of its compute budget.
            {analysis.hotSpots[0] && (
              <> The <span className="text-purple">{analysis.hotSpots[0].program.shortName}</span> step alone uses {((analysis.hotSpots[0].computeUnits!.consumed / (analysis.budget || 1)) * 100).toFixed(1)}% — optimizing that path could save significant CU.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'red' | 'green' }) {
  const valueClass = tone === 'red' ? 'text-red' : 'text-ink';
  return (
    <div className="border border-line rounded px-2.5 py-2 bg-surface">
      <div className="text-[10px] text-mute uppercase tracking-wider">{label}</div>
      <div className={`mt-0.5 ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-dim mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
