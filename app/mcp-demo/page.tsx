'use client';

import { useState, useEffect } from 'react';
import { Server, ArrowRight, Github, RefreshCw, Copy, Check } from 'lucide-react';
import CopyButton from '@/components/CopyButton';
import { ThemeToggle } from '@/components/ThemeToggle';

const ENDPOINT = '/api/mcp';
const DEFAULT_SIG = 'm35hGuBWRAXkTQZ1eSAhbxCcFaLKSgPLydkd1kJtwT1FuYMTKkPJ4jZJ9LyiTrM58n5DmHRcHPUdHkfR29W4qWs';

const TOOLS = [
  { name: 'explain_failure', label: 'human-readable failure with category, cause, and fix', needs: 'signature', tier: 'agent-favorite' },
  { name: 'analyze_transaction', label: 'full IR · CPI tree · compute · balance changes', needs: 'signature' },
  { name: 'list_protocols', label: 'supported DeFi adapters (Jupiter, Raydium, Orca, Drift, Meteora, pump.fun)', needs: '' },
  { name: 'get_recent_failures', label: 'live feed from Jupiter, Raydium, Orca, SPL Token', needs: 'limit' },
];

function shorten(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

export default function McpDemoPage() {
  const [tool, setTool] = useState('explain_failure');
  const [signature, setSignature] = useState(DEFAULT_SIG);
  const [limit, setLimit] = useState(10);
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curlCmd, setCurlCmd] = useState('');
  const [requestLog, setRequestLog] = useState<{ req: any; res: any; ts: number }[]>([]);
  const [now, setNow] = useState('');

  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().replace('T', ' ').slice(11, 19) + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const buildPayload = () => {
    const args: any = {};
    const selected = TOOLS.find((t) => t.name === tool);
    if (selected?.needs === 'signature') args.signature = signature;
    if (selected?.needs === 'limit') args.limit = limit;
    return {
      jsonrpc: '2.0',
      id: requestLog.length + 1,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    };
  };

  const updateCurlPreview = (payload: any) => {
    setCurlCmd(
      `curl -X POST http://localhost:3000${ENDPOINT} \\\n` +
        `  -H "Content-Type: application/json" \\\n` +
        `  -d '${JSON.stringify(payload)}'`
    );
  };

  const call = async () => {
    setLoading(true);
    setError(null);
    const payload = buildPayload();
    updateCurlPreview(payload);
    const t0 = performance.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const ms = Math.round(performance.now() - t0);
      setResponse({ ...data, _ms: ms });
      setRequestLog((log) => [{ req: payload, res: data, ts: Date.now() }, ...log].slice(0, 5));
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const listTools = async () => {
    setLoading(true);
    setError(null);
    const payload = { jsonrpc: '2.0', id: requestLog.length + 1, method: 'tools/list' };
    const t0 = performance.now();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const ms = Math.round(performance.now() - t0);
      setResponse({ ...data, _ms: ms });
      setRequestLog((log) => [{ req: payload, res: data, ts: Date.now() }, ...log].slice(0, 5));
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (!response) return null;
    if (response.error) {
      return (
        <div className="text-red text-xs">
          <div className="text-mute mb-1">! error</div>
          <pre className="whitespace-pre-wrap">{JSON.stringify(response.error, null, 2)}</pre>
        </div>
      );
    }
    if (response.result?.content?.[0]?.text) {
      const text = response.result.content[0].text;
      // Try to parse if it's JSON for pretty rendering
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          // Looks like a list of failures or protocols
          return (
            <div className="space-y-1.5">
              {parsed.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="border border-line rounded px-3 py-1.5 text-[11px] font-mono">
                  {typeof item === 'object' ? (
                    <div className="space-y-0.5">
                      {item.programName && (
                        <div>
                          <span className="text-purple">{item.programName}</span>
                          <span className="text-mute"> · slot </span>
                          <span className="text-ink">{item.slot?.toLocaleString()}</span>
                        </div>
                      )}
                      {item.name && !item.programName && (
                        <div>
                          <span className="text-green">{item.name}</span>
                          <span className="text-mute"> · </span>
                          <span className="text-mute">{item.id?.slice(0, 16)}…</span>
                        </div>
                      )}
                      {item.error && (
                        <div className="text-red truncate">{item.error.slice(0, 100)}</div>
                      )}
                      {item.signature && (
                        <div className="text-mute truncate">
                          sig: {shorten(item.signature, 16)}…{item.signature.slice(-8)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-ink">{String(item)}</div>
                  )}
                </div>
              ))}
              {parsed.length > 5 && (
                <div className="text-[10px] text-mute text-center pt-1">
                  + {parsed.length - 5} more (raw JSON below)
                </div>
              )}
              <details className="mt-2">
                <summary className="text-[10px] text-mute cursor-pointer hover:text-green">view raw</summary>
                <pre className="mt-2 text-[10px] text-dim whitespace-pre-wrap break-all bg-bg border border-line rounded p-2">
                  {text}
                </pre>
              </details>
            </div>
          );
        }
        // Single object
        return (
          <div className="text-xs space-y-1 font-mono">
            {Object.entries(parsed).slice(0, 6).map(([k, v]) => (
              <div key={k}>
                <span className="text-mute">{k}:</span>{' '}
                <span className="text-ink">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
              </div>
            ))}
            <details className="mt-2">
              <summary className="text-[10px] text-mute cursor-pointer hover:text-green">view full raw</summary>
              <pre className="mt-2 text-[10px] text-dim whitespace-pre-wrap break-all bg-bg border border-line rounded p-2">
                {text}
              </pre>
            </details>
          </div>
        );
      } catch {
        // Plain text (e.g., explain_failure output)
        return (
          <pre className="text-xs text-ink whitespace-pre-wrap font-mono leading-relaxed">{text}</pre>
        );
      }
    }
    if (response.result?.tools) {
      return (
        <div className="space-y-2">
          {response.result.tools.map((t: any) => (
            <div key={t.name} className="border-l-2 border-green pl-3 py-1">
              <div className="text-green font-mono font-semibold text-sm">{t.name}</div>
              <div className="text-xs text-dim mt-0.5">{t.description}</div>
            </div>
          ))}
        </div>
      );
    }
    return <pre className="text-xs text-dim whitespace-pre-wrap">{JSON.stringify(response, null, 2)}</pre>;
  };

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
          <span>/mcp-demo</span>
          <span className="text-line">·</span>
          <span className="flex items-center gap-1.5 text-green">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            server live
          </span>
          <span className="text-line">·</span>
          <span className="text-dim">{now}</span>
          <div className="ml-auto flex items-center gap-3">
            <span>POST {ENDPOINT}</span>
            <span className="text-line">·</span>
            <a href="https://github.com/srivtx/sortie" target="_blank" rel="noreferrer" className="hover:text-green flex items-center gap-1">
              <Github className="w-3 h-3" /> source
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            <span className="text-ink">MCP server</span>{' '}
            <span className="text-purple">playground</span>
          </h1>
          <p className="text-sm text-dim">
            <span className="text-mute"># </span>
            JSON-RPC 2.0 over HTTP. Click a tool, watch the round-trip. Or use it from any agent.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT: tools picker */}
          <div>
            <div className="text-[10px] text-mute mb-2">$ choose a tool</div>
            <div className="space-y-1.5 mb-4">
              {TOOLS.map((t) => {
                const isActive = tool === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => { setTool(t.name); setResponse(null); setError(null); }}
                    className={`w-full text-left border rounded transition font-mono ${
                      isActive
                        ? 'border-green bg-green/5 text-green'
                        : 'border-line bg-surface text-dim hover:border-line2 hover:text-ink'
                    }`}
                  >
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-mute">$</span>
                        <span className="font-semibold">sortie {t.name}</span>
                        {t.tier === 'agent-favorite' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-green/10 text-green border border-green/30 rounded">
                            AGENT FAVORITE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-mute mt-1 pl-3">{t.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Tool-specific params */}
            <div className="border border-line rounded bg-surface mb-3">
              {TOOLS.find((t) => t.name === tool)?.needs === 'signature' && (
                <div className="p-3">
                  <div className="text-[10px] text-mute mb-1.5">$ --signature</div>
                  <input
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="paste base58 signature"
                    className="w-full bg-bg border border-line rounded px-3 py-1.5 text-ink placeholder:text-dim2 outline-none focus:border-green font-mono text-xs"
                    spellCheck={false}
                  />
                </div>
              )}
              {TOOLS.find((t) => t.name === tool)?.needs === 'limit' && (
                <div className="p-3">
                  <div className="text-[10px] text-mute mb-1.5">$ --limit</div>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                    className="w-full bg-bg border border-line rounded px-3 py-1.5 text-ink outline-none focus:border-green font-mono text-xs"
                  />
                </div>
              )}
              {TOOLS.find((t) => t.name === tool)?.needs === '' && (
                <div className="p-3 text-[10px] text-mute">
                  $ no args needed
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={call}
                disabled={loading}
                className="bg-green text-bg font-bold py-2 rounded text-sm hover:opacity-90 disabled:opacity-50 font-mono flex items-center justify-center gap-2"
              >
                {loading ? '⏵' : '▶'} {loading ? 'calling' : 'call ' + tool}
              </button>
              <button
                onClick={listTools}
                disabled={loading}
                className="border border-line text-dim py-2 rounded text-sm hover:border-line2 hover:text-ink disabled:opacity-50 font-mono"
              >
                $ tools/list
              </button>
            </div>
          </div>

          {/* RIGHT: response */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-mute">$ response</div>
              {response?._ms && (
                <div className="text-[10px] text-mute">
                  <span className="text-green">{response._ms}ms</span>
                </div>
              )}
            </div>

            <div className="border border-line rounded bg-bg">
              <div className="flex items-center gap-1.5 px-3 h-7 bg-chrome border-b border-line text-[10px] text-mute">
                <span className="w-2 h-2 rounded-full bg-red/60" />
                <span className="w-2 h-2 rounded-full bg-amber/60" />
                <span className="w-2 h-2 rounded-full bg-green/60" />
                <span className="ml-2">~ sortie response</span>
                {response && (
                  <span className="ml-auto text-green">
                    {response.result ? '✓ 200' : '✗ error'}
                  </span>
                )}
              </div>
              <div className="p-4 min-h-[200px]">
                {error ? (
                  <div className="text-red text-xs font-mono">
                    <div className="text-mute mb-1">! network error</div>
                    {error}
                  </div>
                ) : response ? (
                  renderContent()
                ) : (
                  <div className="text-xs text-dim2 font-mono py-12 text-center">
                    <div>$ awaiting input</div>
                    <div className="text-[10px] mt-1">click a tool on the left, or hit call</div>
                  </div>
                )}
              </div>
            </div>

            {curlCmd && (
              <details className="mt-2" open>
                <summary className="text-[10px] text-mute cursor-pointer hover:text-green">$ view curl</summary>
                <div className="relative mt-2">
                  <pre className="border border-line bg-surface text-mute p-3 pr-12 rounded text-[10px] overflow-x-auto font-mono leading-relaxed">
                    {curlCmd}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton value={curlCmd.replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ').trim()} label="curl" />
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Recent requests log */}
        {requestLog.length > 0 && (
          <section className="mt-8">
            <div className="text-[10px] text-mute mb-2">$ tail -f /var/log/sortie/mcp.log</div>
            <div className="border border-line rounded bg-bg divide-y divide-[#1f1f1f]">
              {requestLog.map((entry, i) => {
                const ts = new Date(entry.ts).toISOString().slice(11, 19);
                const ok = entry.res?.result !== undefined;
                return (
                  <div key={i} className="px-3 py-2 font-mono text-[11px] flex items-center gap-3">
                    <span className="text-mute">{ts}</span>
                    <span className={ok ? 'text-green' : 'text-red'}>
                      {ok ? '✓ 200' : '✗ err'}
                    </span>
                    <span className="text-purple">{entry.req.method}</span>
                    {entry.req.params?.name && (
                      <span className="text-ink">{entry.req.params.name}</span>
                    )}
                    {entry.res?._ms && (
                      <span className="text-mute ml-auto">{entry.res._ms}ms</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* MCP config — cat output style */}
        <section className="mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] text-mute mb-2"># wire it into your agent</div>
              <p className="text-sm text-dim leading-relaxed">
                <span className="text-mute">$ </span>drop this into{' '}
                <code className="text-green">~/.config/claude/mcp.json</code> (or
                your client&apos;s equivalent) and{' '}
                <code className="text-ink">sortie</code> is live in every agent session.
                No npm, no auth, no version churn.
              </p>
              <p className="text-xs text-mute mt-3">
                Tested with: Claude Code · OpenCode · any MCP-compatible client
              </p>
            </div>

            <div className="border border-line rounded bg-bg overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 h-7 bg-surface2 border-b border-line text-[10px] text-mute">
                <span className="w-2 h-2 rounded-full bg-red/60" />
                <span className="w-2 h-2 rounded-full bg-amber/60" />
                <span className="w-2 h-2 rounded-full bg-green/60" />
                <span className="ml-2">~ cat .config/claude/mcp.json</span>
                <div className="ml-auto">
                  <CopyButton value={`{
  "mcpServers": {
    "sortie": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}`} label="json" />
                </div>
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
        </section>
      </div>
    </div>
  );
}
