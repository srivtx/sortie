'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isValidSignature } from '@/lib/utils';
import RecentFailures from '@/components/RecentFailures';
import { Github, Server, ArrowRight, AlertTriangle, Activity, Cpu, GitBranch, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  const [signature, setSignature] = useState('');
  const [network, setNetwork] = useState('mainnet');
  const [error, setError] = useState('');
  const [now, setNow] = useState<string>('');
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await fetch('/api/recent-failures?limit=20');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setLiveCount(data.count || 0);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = signature.trim();
    if (!trimmed) { setError('usage: sortie analyze --tx <signature>'); return; }
    if (!isValidSignature(trimmed)) { setError('error: invalid base58 signature (87-88 chars expected)'); return; }
    router.push(`/tx/${trimmed}?network=${network}`);
  };

  const examples = [
    { sig: 'RpD8UKoUfigqQZUYPqCWpWRnzHxJ1axDUNvKG9Pbonm2T3mT3iDvp7JtYssTJbAcVZFaXfkBnhk1g9JWYy3UPBP', net: 'mainnet', label: 'simple success', meta: '2 steps · 58K CUs', tone: 'green' as const },
    { sig: '5wwW4h8QGFGNF5Jygz6gH2p11Vaxt8X14cKzHX8YvwAwsDJDg1bYRNjdfDXk7L2pV4e8kp1yDXvoWM31cJC8vGoZ', net: 'mainnet', label: 'complex CPI · pump.fun', meta: '6 root · 26 total', tone: 'purple' as const },
    { sig: 'm35hGuBWRAXkTQZ1eSAhbxCcFaLKSgPLydkd1kJtwT1FuYMTKkPJ4jZJ9LyiTrM58n5DmHRcHPUdHkfR29W4qWs', net: 'mainnet', label: 'failed · jupiter', meta: 'slippage 0x1771', tone: 'red' as const },
  ];

  return (
    <div className="min-h-screen scanlines">
      {/* Status bar */}
      <div className="border-b border-line bg-bg text-[10px] text-mute font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-6 flex items-center gap-4 overflow-x-auto whitespace-nowrap">
          <span className="flex items-center gap-1.5 text-green">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            online
          </span>
          <span className="text-line">·</span>
          <span>net:mainnet</span>
          <span className="text-line">·</span>
          <span>v0.1.0</span>
          <span className="text-line">·</span>
          <span className="text-dim">{now}</span>
          <span className="text-line">·</span>
          <a href="/mcp-demo" className="hover:text-green">mcp:on</a>
          <span className="text-line">·</span>
          <a href="https://github.com/srivtx/sortie" target="_blank" rel="noreferrer" className="hover:text-green">github</a>
        </div>
      </div>

      {/* Hero / terminal */}
      <section className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.svg" alt="SORTIE" className="w-9 h-9" />
            <div>
              <div className="text-ink text-lg font-bold tracking-tight">SORTIE</div>
              <div className="text-[10px] text-mute">semantic execution debugger · solana</div>
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-mute">
              <a href="/mcp-demo" className="hover:text-green flex items-center gap-1">
                <Server className="w-3 h-3" /> mcp
              </a>
              <a href="https://github.com/srivtx/sortie" target="_blank" rel="noreferrer" className="hover:text-green flex items-center gap-1">
                <Github className="w-3 h-3" /> source
              </a>
              <ThemeToggle />
            </div>
          </div>

          {/* Tagline */}
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-3">
            <span className="text-ink">why did your</span>{' '}
            <span className="text-purple">solana tx</span>{' '}
            <span className="text-ink">fail?</span>
          </h1>
          <p className="text-dim text-sm max-w-2xl mb-8 leading-relaxed">
            <span className="text-mute"># </span>stop reading hex. stop guessing error codes.{' '}
            <span className="text-ink">sortie</span> reconstructs the execution tree, decodes the failure,
            and tells you what to fix.
          </p>

          {/* Terminal input */}
          <form onSubmit={handleSubmit} className="max-w-3xl">
            <div className="border border-line rounded-lg overflow-hidden bg-surface">
              <div className="flex items-center gap-1.5 px-3 h-7 bg-[#111] border-b border-line text-[10px] text-mute">
                <span className="w-2 h-2 rounded-full bg-red/60" />
                <span className="w-2 h-2 rounded-full bg-amber/60" />
                <span className="w-2 h-2 rounded-full bg-green/60" />
                <span className="ml-2">sortie@mainnet ~ %</span>
              </div>
              <div className="p-3 sm:p-4 font-mono text-sm">
                <div className="flex items-center gap-2 text-mute mb-2">
                  <span className="text-green">$</span>
                  <span>sortie analyze</span>
                  <span className="text-purple">--tx</span>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="bg-transparent text-purple outline-none cursor-pointer font-mono"
                  >
                    <option value="mainnet" className="bg-surface">--mainnet</option>
                    <option value="devnet" className="bg-surface">--devnet</option>
                    <option value="testnet" className="bg-surface">--testnet</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green">›</span>
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="paste base58 signature (87-88 chars)"
                    className="flex-1 bg-transparent text-ink placeholder:text-dim2 outline-none font-mono text-sm"
                    autoFocus
                    spellCheck={false}
                  />
                </div>
                {error && (
                  <div className="mt-2 text-red text-xs">
                    <span className="text-mute">! </span>{error}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-[10px] text-dim2">
                  <span>↵ run</span>
                  <span>--network {network}</span>
                </div>
              </div>
            </div>
          </form>

          {/* Examples as commands */}
          <div className="mt-5 max-w-3xl">
            <div className="text-[10px] text-mute mb-2"># or try an example:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono text-xs">
              {examples.map((ex) => {
                const toneColor = {
                  green: 'border-green/30 hover:border-green/60 text-green',
                  purple: 'border-purple/30 hover:border-purple/60 text-purple',
                  red: 'border-red/30 hover:border-red/60 text-red',
                }[ex.tone];
                return (
                  <button
                    key={ex.sig}
                    onClick={() => { setSignature(ex.sig); setNetwork(ex.net); setError(''); }}
                    className={`group text-left bg-surface border ${toneColor} rounded px-3 py-2 transition`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="opacity-60">$</span>
                      <span className="truncate">{ex.label}</span>
                    </div>
                    <div className="text-mute text-[10px] pl-3">{ex.meta}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Live ops feed */}
      <section className="border-b border-line bg-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-center gap-2 text-[11px] text-dim">
              <span className="text-green">●</span>
              <span className="font-semibold text-ink">live</span>
              <span>// recent failures on mainnet</span>
              {liveCount !== null && (
                <span className="text-mute">· {liveCount} found</span>
              )}
            </div>
            <span className="text-[10px] text-dim2">refresh: 15s</span>
          </div>
          <RecentFailures />
        </div>
      </section>

      {/* What you get — command help style */}
      <section className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-[11px] text-mute mb-3">$ sortie --help</div>
          <div className="border border-line rounded-lg bg-surface divide-y divide-[#1f1f1f]">
            {[
              { icon: Activity, cmd: 'analyze', desc: 'full IR · CPI tree · compute · balance changes · protocol detection' },
              { icon: GitBranch, cmd: 'tree', desc: 'cross-program invocation tree, clickable, with compute + logs' },
              { icon: Cpu, cmd: 'profile', desc: 'per-step CU breakdown with hot-spot detection, sorted by cost' },
              { icon: Zap, cmd: 'explain', desc: 'category · severity · probable cause · fix suggestion, in plain English' },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.cmd} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <Icon className="w-3.5 h-3.5 text-mute mt-0.5 shrink-0" />
                  <span className="text-green font-bold shrink-0">sortie {c.cmd}</span>
                  <span className="text-mute text-xs">{c.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* For agents — cat output style */}
      <section className="border-b border-line bg-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] text-mute mb-3"># For AI agents · MCP HTTP server</div>
              <p className="text-sm text-dim leading-relaxed mb-3">
                Every Claude Code, Codex, OpenCode session can call{' '}
                <code className="text-green">sortie.explain_failure</code> directly.
                No browser. No copy-paste. Just an answer.
              </p>
              <p className="text-sm text-dim leading-relaxed">
                <a href="/mcp-demo" className="text-green hover:underline">→ Open MCP playground</a>
                <span className="text-mute"> · 4 tools · JSON-RPC 2.0 · http transport</span>
              </p>
            </div>

            <div className="border border-line rounded-lg bg-bg overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 h-7 bg-[#111] border-b border-line text-[10px] text-mute">
                <span className="w-2 h-2 rounded-full bg-red/60" />
                <span className="w-2 h-2 rounded-full bg-amber/60" />
                <span className="w-2 h-2 rounded-full bg-green/60" />
                <span className="ml-2">~ cat .config/claude/mcp.json</span>
              </div>
              <pre className="p-4 text-xs text-ink overflow-x-auto leading-relaxed font-mono">
{`{
  "mcpServers": {
    "sortie": {
      "type": "http",
      "url": "http://localhost:3000`}<span className="text-purple">{`/api/mcp`}</span>{`"
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-mute font-mono">
          <div>
            <span className="text-green">$</span> exit · sortie v0.1.0 · mit
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/srivtx/sortie" target="_blank" rel="noreferrer" className="hover:text-green">github.com/srivtx/sortie</a>
            <span className="text-line">·</span>
            <a href="/mcp-demo" className="hover:text-green">mcp demo</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
