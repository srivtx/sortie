'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isValidSignature } from '@/lib/utils';
import RecentFailures from '@/components/RecentFailures';
import { Github, Server, ArrowRight, AlertTriangle, Activity, Cpu, GitBranch, Zap } from 'lucide-react';

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
      <div className="border-b border-[#1f1f1f] bg-[#0a0a0a] text-[10px] text-[#737373] font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-6 flex items-center gap-4 overflow-x-auto whitespace-nowrap">
          <span className="flex items-center gap-1.5 text-[#14F195]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
            online
          </span>
          <span className="text-[#1f1f1f]">·</span>
          <span>net:mainnet</span>
          <span className="text-[#1f1f1f]">·</span>
          <span>v0.1.0</span>
          <span className="text-[#1f1f1f]">·</span>
          <span className="text-[#a3a3a3]">{now}</span>
          <span className="text-[#1f1f1f]">·</span>
          <a href="/mcp-demo" className="hover:text-[#14F195]">mcp:on</a>
          <span className="text-[#1f1f1f]">·</span>
          <a href="https://github.com/srivtx/sortie" target="_blank" rel="noreferrer" className="hover:text-[#14F195]">github</a>
        </div>
      </div>

      {/* Hero / terminal */}
      <section className="border-b border-[#1f1f1f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.svg" alt="SORTIE" className="w-9 h-9" />
            <div>
              <div className="text-[#e5e5e5] text-lg font-bold tracking-tight">SORTIE</div>
              <div className="text-[10px] text-[#737373]">semantic execution debugger · solana</div>
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-[#737373]">
              <a href="/mcp-demo" className="hover:text-[#14F195] flex items-center gap-1">
                <Server className="w-3 h-3" /> mcp
              </a>
              <a href="https://github.com/srivtx/sortie" target="_blank" rel="noreferrer" className="hover:text-[#14F195] flex items-center gap-1">
                <Github className="w-3 h-3" /> source
              </a>
            </div>
          </div>

          {/* Tagline */}
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-3">
            <span className="text-[#e5e5e5]">why did your</span>{' '}
            <span className="text-[#9945FF]">solana tx</span>{' '}
            <span className="text-[#e5e5e5]">fail?</span>
          </h1>
          <p className="text-[#a3a3a3] text-sm max-w-2xl mb-8 leading-relaxed">
            <span className="text-[#737373]"># </span>stop reading hex. stop guessing error codes.{' '}
            <span className="text-[#e5e5e5]">sortie</span> reconstructs the execution tree, decodes the failure,
            and tells you what to fix.
          </p>

          {/* Terminal input */}
          <form onSubmit={handleSubmit} className="max-w-3xl">
            <div className="border border-[#1f1f1f] rounded-lg overflow-hidden bg-[#0d0d0d]">
              <div className="flex items-center gap-1.5 px-3 h-7 bg-[#111] border-b border-[#1f1f1f] text-[10px] text-[#737373]">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]/60" />
                <span className="w-2 h-2 rounded-full bg-[#fbbf24]/60" />
                <span className="w-2 h-2 rounded-full bg-[#14F195]/60" />
                <span className="ml-2">sortie@mainnet ~ %</span>
              </div>
              <div className="p-3 sm:p-4 font-mono text-sm">
                <div className="flex items-center gap-2 text-[#737373] mb-2">
                  <span className="text-[#14F195]">$</span>
                  <span>sortie analyze</span>
                  <span className="text-[#9945FF]">--tx</span>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="bg-transparent text-[#9945FF] outline-none cursor-pointer font-mono"
                  >
                    <option value="mainnet" className="bg-[#0d0d0d]">--mainnet</option>
                    <option value="devnet" className="bg-[#0d0d0d]">--devnet</option>
                    <option value="testnet" className="bg-[#0d0d0d]">--testnet</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#14F195]">›</span>
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="paste base58 signature (87-88 chars)"
                    className="flex-1 bg-transparent text-[#e5e5e5] placeholder:text-[#404040] outline-none font-mono text-sm"
                    autoFocus
                    spellCheck={false}
                  />
                </div>
                {error && (
                  <div className="mt-2 text-[#ef4444] text-xs">
                    <span className="text-[#737373]">! </span>{error}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-[10px] text-[#404040]">
                  <span>↵ run</span>
                  <span>--network {network}</span>
                </div>
              </div>
            </div>
          </form>

          {/* Examples as commands */}
          <div className="mt-5 max-w-3xl">
            <div className="text-[10px] text-[#737373] mb-2"># or try an example:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 font-mono text-xs">
              {examples.map((ex) => {
                const toneColor = {
                  green: 'border-[#14F195]/30 hover:border-[#14F195]/60 text-[#14F195]',
                  purple: 'border-[#9945FF]/30 hover:border-[#9945FF]/60 text-[#9945FF]',
                  red: 'border-[#ef4444]/30 hover:border-[#ef4444]/60 text-[#ef4444]',
                }[ex.tone];
                return (
                  <button
                    key={ex.sig}
                    onClick={() => { setSignature(ex.sig); setNetwork(ex.net); setError(''); }}
                    className={`group text-left bg-[#0d0d0d] border ${toneColor} rounded px-3 py-2 transition`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="opacity-60">$</span>
                      <span className="truncate">{ex.label}</span>
                    </div>
                    <div className="text-[#737373] text-[10px] pl-3">{ex.meta}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Live ops feed */}
      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-center gap-2 text-[11px] text-[#a3a3a3]">
              <span className="text-[#14F195]">●</span>
              <span className="font-semibold text-[#e5e5e5]">live</span>
              <span>// recent failures on mainnet</span>
              {liveCount !== null && (
                <span className="text-[#737373]">· {liveCount} found</span>
              )}
            </div>
            <span className="text-[10px] text-[#404040]">refresh: 15s</span>
          </div>
          <RecentFailures />
        </div>
      </section>

      {/* What you get — command help style */}
      <section className="border-b border-[#1f1f1f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-[11px] text-[#737373] mb-3">$ sortie --help</div>
          <div className="border border-[#1f1f1f] rounded-lg bg-[#0d0d0d] divide-y divide-[#1f1f1f]">
            {[
              { icon: Activity, cmd: 'analyze', desc: 'full IR · CPI tree · compute · balance changes · protocol detection' },
              { icon: GitBranch, cmd: 'tree', desc: 'cross-program invocation tree, clickable, with compute + logs' },
              { icon: Cpu, cmd: 'profile', desc: 'per-step CU breakdown with hot-spot detection, sorted by cost' },
              { icon: Zap, cmd: 'explain', desc: 'category · severity · probable cause · fix suggestion, in plain English' },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.cmd} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <Icon className="w-3.5 h-3.5 text-[#737373] mt-0.5 shrink-0" />
                  <span className="text-[#14F195] font-bold shrink-0">sortie {c.cmd}</span>
                  <span className="text-[#737373] text-xs">{c.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* For agents — cat output style */}
      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] text-[#737373] mb-3"># For AI agents · MCP HTTP server</div>
              <p className="text-sm text-[#a3a3a3] leading-relaxed mb-3">
                Every Claude Code, Codex, OpenCode session can call{' '}
                <code className="text-[#14F195]">sortie.explain_failure</code> directly.
                No browser. No copy-paste. Just an answer.
              </p>
              <p className="text-sm text-[#a3a3a3] leading-relaxed">
                <a href="/mcp-demo" className="text-[#14F195] hover:underline">→ Open MCP playground</a>
                <span className="text-[#737373]"> · 4 tools · JSON-RPC 2.0 · http transport</span>
              </p>
            </div>

            <div className="border border-[#1f1f1f] rounded-lg bg-[#0a0a0a] overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 h-7 bg-[#111] border-b border-[#1f1f1f] text-[10px] text-[#737373]">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]/60" />
                <span className="w-2 h-2 rounded-full bg-[#fbbf24]/60" />
                <span className="w-2 h-2 rounded-full bg-[#14F195]/60" />
                <span className="ml-2">~ cat .config/claude/mcp.json</span>
              </div>
              <pre className="p-4 text-xs text-[#e5e5e5] overflow-x-auto leading-relaxed font-mono">
{`{
  "mcpServers": {
    "sortie": {
      "type": "http",
      "url": "http://localhost:3000`}<span className="text-[#9945FF]">{`/api/mcp`}</span>{`"
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-[#737373] font-mono">
          <div>
            <span className="text-[#14F195]">$</span> exit · sortie v0.1.0 · mit
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/srivtx/sortie" target="_blank" rel="noreferrer" className="hover:text-[#14F195]">github.com/srivtx/sortie</a>
            <span className="text-[#1f1f1f]">·</span>
            <a href="/mcp-demo" className="hover:text-[#14F195]">mcp demo</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
