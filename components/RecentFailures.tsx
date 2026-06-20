'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import CopyButton from './CopyButton';

interface Failure {
  signature: string;
  slot: number;
  blockTime: number | null;
  program: string;
  programName: string;
  error: string;
  fee: number;
}

function shorten(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function timeAgo(blockTime: number | null): string {
  if (!blockTime) return 'unknown';
  const secs = Math.floor(Date.now() / 1000) - blockTime;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function shortErr(s: string): string {
  // Try to extract the most readable part of the error
  const m = s.match(/"Custom":(\d+)/);
  if (m) return `0x${parseInt(m[1]).toString(16)}`;
  const m2 = s.match(/"ProgramError":"([^"]+)"/);
  if (m2) return m2[1];
  return shorten(s.replace(/[{}"]/g, ''), 40);
}

export default function RecentFailures() {
  const router = useRouter();
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recent-failures?limit=10', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load');
        return;
      }
      setFailures(data.failures || []);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 15000);
    return () => clearInterval(interval);
  }, []);

  const openTx = (sig: string) => {
    router.push(`/tx/${sig}?network=mainnet`);
  };

  return (
    <div className="font-mono">
      {error && (
        <div className="text-red text-xs bg-red/5 border border-red/20 rounded px-3 py-2 mb-3">
          <span className="text-mute">! </span>{error}
          <span className="text-mute"> · public RPC may be rate-limited. retry in 60s.</span>
        </div>
      )}

      {loading && failures.length === 0 ? (
        <div className="text-xs text-mute py-6">$ scanning mainnet…</div>
      ) : failures.length === 0 ? (
        <div className="text-xs text-mute py-6">
          <span className="text-green">$ </span>no recent failures found. either everything is working or RPC is rate-limited.
        </div>
      ) : (
        <div className="border border-line rounded overflow-hidden bg-bg">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[110px_120px_1fr_180px_60px] gap-3 px-3 py-1.5 text-[10px] text-mute uppercase tracking-wider border-b border-line">
            <span>time</span>
            <span>program</span>
            <span>signature</span>
            <span>error</span>
            <span className="text-right">slot</span>
          </div>
          {failures.map((f) => (
            <div
              key={f.signature}
              className="group grid grid-cols-[60px_80px_1fr_auto] sm:grid-cols-[110px_120px_1fr_180px_60px_auto] gap-3 px-3 py-1.5 text-xs border-b border-line last:border-b-0 hover:bg-surface2 transition font-mono"
            >
              <button
                onClick={() => openTx(f.signature)}
                className="contents text-left"
              >
                <span className="text-mute">{timeAgo(f.blockTime)}</span>
                <span className="text-purple truncate">{f.programName}</span>
                <span className="text-ink truncate text-[11px]">
                  {shorten(f.signature, 14)}…{f.signature.slice(-8)}
                </span>
                <span className="hidden sm:block text-red truncate text-[11px]">{shortErr(f.error)}</span>
                <span className="hidden sm:block text-mute text-right text-[11px]">{f.slot.toLocaleString()}</span>
              </button>
              <div className="opacity-0 group-hover:opacity-100 transition">
                <CopyButton value={f.signature} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[10px] text-dim2">
        <span># click any row to analyze</span>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-mute hover:text-green disabled:opacity-50"
        >
          {refreshing ? 'refreshing…' : '↻ refresh'}
        </button>
      </div>
    </div>
  );
}
