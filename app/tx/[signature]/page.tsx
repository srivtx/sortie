'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ExecutionIR } from '@/lib/ir/types';
import { formatLamports, formatTimestamp, formatSlot, shorten } from '@/lib/utils';
import CpiFlow from '@/components/CpiFlow';
import ExecutionTimeline from '@/components/ExecutionTimeline';
import FailureAnalysisPanel from '@/components/FailureAnalysis';
import ComputeProfiler from '@/components/ComputeProfiler';
import CopyButton from '@/components/CopyButton';
import { Activity, Layers, FileJson, Cpu, DollarSign, BarChart3, ArrowLeft, AlertCircle, CheckCircle2, Link as LinkIcon, Share2 } from 'lucide-react';

type Tab = 'timeline' | 'cpi-tree' | 'compute' | 'logs' | 'raw';

const TABS: { id: Tab; cmd: string; label: string; icon: any }[] = [
  { id: 'timeline', cmd: 'timeline', label: 'Execution Timeline', icon: Activity },
  { id: 'cpi-tree', cmd: 'tree', label: 'CPI Tree', icon: Layers },
  { id: 'compute', cmd: 'profile', label: 'Compute Profile', icon: BarChart3 },
  { id: 'logs', cmd: 'logs', label: 'Program Logs', icon: FileJson },
  { id: 'raw', cmd: 'raw', label: 'Raw IR', icon: FileJson },
];

export default function TransactionPage() {
  const { signature } = useParams();
  const searchParams = useSearchParams();
  const network = searchParams.get('network') || 'mainnet';
  const [ir, setIr] = useState<ExecutionIR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const [fetchMs, setFetchMs] = useState<number | null>(null);

  useEffect(() => {
    if (!signature) return;

    const fetchTransaction = async () => {
      setLoading(true);
      setError('');

      const t0 = performance.now();
      try {
        const res = await fetch(`/api/transaction/${signature}?network=${network}`);
        const data = await res.json();
        setFetchMs(Math.round(performance.now() - t0));

        if (!res.ok) {
          setError(data.error || 'Failed to fetch');
          return;
        }

        setIr(data);
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [signature, network]);

  return (
    <div className="min-h-screen scanlines">
      {/* Status bar */}
      <div className="border-b border-line bg-bg text-[10px] text-mute font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-6 flex items-center gap-4 overflow-x-auto whitespace-nowrap">
          <a href="/" className="flex items-center gap-1.5 text-ink hover:text-green">
            <img src="/logo.svg" alt="SORTIE" className="w-3.5 h-3.5" />
            <span>sortie</span>
          </a>
          <span className="text-line">·</span>
          <span>analyze</span>
          <span className="text-line">·</span>
          <span className="text-dim truncate">{shorten(String(signature), 14)}…</span>
          <span className="text-line">·</span>
          <span className="text-dim">{network}</span>
          {ir && (
            <>
              <span className="text-line">·</span>
              <span className={ir.success ? 'text-green' : 'text-red'}>
                {ir.success ? '✓ success' : '✗ failed'}
              </span>
              {fetchMs && (
                <>
                  <span className="text-line">·</span>
                  <span className="text-dim">fetched in {fetchMs}ms</span>
                </>
              )}
            </>
          )}
          <a href="/" className="ml-auto hover:text-green flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> back
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 font-mono">
        {loading && (
          <div className="border border-line rounded bg-bg p-6">
            <div className="text-dim text-xs flex items-center gap-2">
              <span className="text-green">$</span>
              <span>sortie analyze --tx</span>
              <span className="text-dim2">{shorten(String(signature), 16)}…</span>
            </div>
            <div className="mt-2 text-mute text-xs animate-pulse">
              ▸ fetching from {network} RPC, building IR…
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="border border-red/30 rounded bg-red/5 p-6">
            <div className="text-red text-xs font-mono">
              <div className="text-mute mb-1">! error</div>
              {error}
            </div>
          </div>
        )}

        {!loading && !error && !ir && (
          <div className="border border-line rounded bg-bg p-6 text-dim text-xs">
            $ no transaction data
          </div>
        )}

        {ir && (
          <>
            {/* Tx summary */}
            <div className="border border-line rounded bg-bg overflow-hidden">
              {/* Status bar */}
              <div className="flex items-center justify-between px-3 h-7 bg-surface2 border-b border-line text-[10px] text-mute">
                <div className="flex items-center gap-2">
                  {ir.success ? (
                    <span className="text-green">✓ tx success</span>
                  ) : (
                    <span className="text-red">✗ tx failed</span>
                  )}
                  <span className="text-line">·</span>
                  <span className="text-dim">slot {formatSlot(ir.slot)}</span>
                </div>
                <span className="text-dim truncate ml-2">{shorten(String(ir.signature), 20)}…</span>
              </div>
              <div className="p-4">
                <div className="flex items-start gap-2 mb-3">
                  <h1 className="font-mono text-sm text-ink break-all flex-1 min-w-0">
                    {ir.signature}
                  </h1>
                  <CopyButton value={ir.signature} label="sig" />
                </div>
                <div className="flex items-center gap-2 mb-3 text-[10px] text-mute">
                  <span>$ share url</span>
                  <code className="text-dim truncate flex-1 min-w-0 bg-surface border border-line rounded px-2 py-1 font-mono">
                    {typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''}?network={network}
                  </code>
                  <CopyButton value={typeof window !== 'undefined' ? `${window.location.origin}/tx/${ir.signature}?network=${network}` : ''} label="url" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Metric label="time" value={formatTimestamp(ir.timestamp)} />
                  <Metric label="fee" value={`${formatLamports(ir.fee.total)}`} suffix="lamports" />
                  <Metric
                    label="compute"
                    value={`${ir.compute.consumed?.toLocaleString() || '?'}`}
                    suffix={ir.compute.utilizationPercent !== null ? `${ir.compute.utilizationPercent}%` : undefined}
                    tone={ir.compute.utilizationPercent !== null && ir.compute.utilizationPercent > 90 ? 'red' : 'green'}
                  />
                  <Metric label="steps" value={String(ir.allSteps.length)} suffix={`${ir.steps.length} root`} />
                </div>
                {ir.protocols.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line text-xs">
                    <span className="text-mute">protocols: </span>
                    {ir.protocols.map((p, i) => (
                      <span key={i} className="text-purple mr-2">· {p.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Failure Analysis */}
            {!ir.success && (
              <div className="mt-4">
                <FailureAnalysisPanel ir={ir} />
              </div>
            )}

            {/* Tabs */}
            <div className="mt-6 border border-line rounded bg-bg overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 px-2 h-9 bg-surface2 border-b border-line text-xs">
                <span className="text-mute px-2">$ sortie show</span>
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition ${
                        isActive
                          ? 'bg-green/10 text-green border border-green/30'
                          : 'text-mute hover:text-ink border border-transparent'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{t.cmd}</span>
                    </button>
                  );
                })}
                <span className="text-mute px-1 ml-auto hidden sm:inline text-[10px]">
                  {TABS.find(t => t.id === activeTab)?.cmd}
                </span>
              </div>
              <div className="p-4">
                {activeTab === 'timeline' && <ExecutionTimeline ir={ir} />}

                {activeTab === 'cpi-tree' && (
                  <div className="-mx-4 -mb-4">
                    <CpiFlow steps={ir.steps} />
                  </div>
                )}

                {activeTab === 'compute' && <ComputeProfiler ir={ir} />}

                {activeTab === 'logs' && (
                  <div>
                    <div className="text-[10px] text-mute mb-2">$ cat program-logs.txt · {ir.rawLogs.length} lines</div>
                    <pre className="bg-bg border border-line rounded p-3 text-[10px] text-ink overflow-auto max-h-[600px] leading-relaxed font-mono">
                      {ir.rawLogs.map((log, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all hover:bg-surface2">
                          <span className="text-dim2 select-none mr-3">{(i + 1).toString().padStart(3, ' ')}</span>
                          {log}
                        </div>
                      ))}
                    </pre>
                  </div>
                )}

                {activeTab === 'raw' && (
                  <div>
                    <div className="text-[10px] text-mute mb-2">$ cat execution-ir.json</div>
                    <pre className="bg-bg border border-line rounded p-3 text-[10px] text-dim overflow-auto max-h-[600px] leading-relaxed font-mono">
                      {JSON.stringify(ir, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* State Changes */}
            {ir.stateChanges.length > 0 && (
              <div className="mt-6">
                <div className="text-[10px] text-mute mb-2">$ sortie state-changes</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* SOL Changes */}
                  {ir.stateChanges.filter(c => c.type === 'sol').length > 0 && (
                    <div className="border border-line rounded bg-bg overflow-hidden">
                      <div className="px-3 py-1.5 bg-surface2 border-b border-line text-[10px] text-dim">
                        SOL balance changes
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-mute text-[10px] uppercase tracking-wider">
                            <th className="px-3 pt-2 pb-1 font-normal">account</th>
                            <th className="px-3 pt-2 pb-1 font-normal text-right">change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ir.stateChanges
                            .filter((c): c is Extract<typeof c, { type: 'sol' }> => c.type === 'sol')
                            .map((change, i) => (
                              <tr key={i} className="border-t border-line hover:bg-surface2">
                                <td className="px-3 py-1.5 text-dim">{shorten(change.account)}</td>
                                <td className={`px-3 py-1.5 text-right ${change.delta > 0 ? 'text-green' : 'text-red'}`}>
                                  {change.delta > 0 ? '+' : ''}{formatLamports(change.delta)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Token Changes */}
                  {ir.stateChanges.filter(c => c.type === 'token').length > 0 && (
                    <div className="border border-line rounded bg-bg overflow-hidden">
                      <div className="px-3 py-1.5 bg-surface2 border-b border-line text-[10px] text-dim">
                        Token balance changes
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-mute text-[10px] uppercase tracking-wider">
                            <th className="px-3 pt-2 pb-1 font-normal">account</th>
                            <th className="px-3 pt-2 pb-1 font-normal">mint</th>
                            <th className="px-3 pt-2 pb-1 font-normal text-right">change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ir.stateChanges
                            .filter((c): c is Extract<typeof c, { type: 'token' }> => c.type === 'token')
                            .map((change, i) => (
                              <tr key={i} className="border-t border-line hover:bg-surface2">
                                <td className="px-3 py-1.5 text-dim">{shorten(change.account)}</td>
                                <td className="px-3 py-1.5 text-dim">{shorten(change.mint)}</td>
                                <td className={`px-3 py-1.5 text-right ${Number(change.delta.raw) > 0 ? 'text-green' : 'text-red'}`}>
                                  {Number(change.delta.raw) > 0 ? '+' : ''}
                                  {change.delta.ui || change.delta.raw}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone?: 'red' | 'green' | 'default' }) {
  const valueClass = tone === 'red' ? 'text-red' : tone === 'green' ? 'text-green' : 'text-ink';
  return (
    <div className="border border-line rounded px-3 py-2 bg-surface">
      <div className="text-[10px] text-mute uppercase tracking-wider">{label}</div>
      <div className={`mt-0.5 font-mono ${valueClass}`}>
        {value}
        {suffix && <span className="text-mute text-[10px] ml-1.5">{suffix}</span>}
      </div>
    </div>
  );
}
