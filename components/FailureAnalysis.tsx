'use client';

import { ExecutionIR } from '@/lib/ir/types';
import { AlertTriangle, AlertCircle, Zap, Database, Cpu } from 'lucide-react';

interface FailureAnalysisProps {
  ir: ExecutionIR;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red',
  warning: 'text-amber',
  info: 'text-dim',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'bg-red/5 border-red/30',
  warning: 'bg-amber/5 border-amber/30',
  info: 'bg-surface border-line',
};

const CATEGORY_ICON: Record<string, any> = {
  insufficient_funds: Database,
  insufficient_compute: Cpu,
  slippage_exceeded: Zap,
  missing_account: AlertCircle,
  account_already_exists: AlertCircle,
  invalid_instruction: AlertTriangle,
  missing_signer: AlertTriangle,
  rent_exemption: Database,
  custom_program: AlertTriangle,
  unknown: AlertCircle,
};

export default function FailureAnalysisPanel({ ir }: FailureAnalysisProps) {
  if (ir.success) return null;
  const f = ir.failure;
  if (!f) return null;

  const analysis = f.analysis;
  const category = analysis?.category || 'unknown';
  const severity = analysis?.severity || 'info';
  const Icon = CATEGORY_ICON[category] || AlertCircle;
  const sevColor = SEVERITY_COLOR[severity] || 'text-dim';
  const sevBg = SEVERITY_BG[severity] || 'bg-surface border-line';
  const ctx = analysis?.context || {};

  return (
    <div className={`border rounded p-4 ${sevBg} font-mono`}>
      <div className="flex items-center gap-2 mb-2 text-[10px] text-mute uppercase tracking-wider">
        <span>$ sortie explain --failure</span>
      </div>

      <div className="flex items-start gap-3 mb-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${sevColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-bold text-sm ${sevColor}`}>
              {category.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 border border-line rounded text-mute">
              {severity}
            </span>
            <span className="text-[10px] text-dim">
              program: <span className="text-purple">{f.failingStep?.program?.shortName || '?'}</span>
            </span>
            <span className="text-[10px] text-dim">
              code: <span className="text-red font-bold">{f.error?.code ?? '?'}</span>
            </span>
          </div>
          <div className="text-xs text-dim font-mono break-all">
            {f.error?.rawMessage || JSON.stringify(f.error)}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-xs border-t border-line pt-3">
        <Field label="why" value={analysis?.explanation} />
        <Field label="cause" value={analysis?.probableCause} />
        <Field label="fix" value={analysis?.fixSuggestion} tone="green" />

        {ctx.feePayerLowBalance && <ContextTag tone="red">⚠ fee payer has insufficient balance</ContextTag>}
        {ctx.computeExceeded && <ContextTag tone="amber">⚠ compute budget exceeded</ContextTag>}
        {ctx.missingTokenAccounts && ctx.missingTokenAccounts.length > 0 && (
          <ContextTag tone="amber">⚠ missing token accounts: {ctx.missingTokenAccounts.join(', ')}</ContextTag>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value?: string; tone?: 'green' | 'default' }) {
  const valueClass = tone === 'green' ? 'text-green' : 'text-ink';
  return (
    <div className="flex gap-2">
      <span className="text-mute shrink-0 w-12 text-[10px] uppercase tracking-wider pt-0.5">
        {label}
      </span>
      <span className={`${valueClass} flex-1`}>{value || '—'}</span>
    </div>
  );
}

function ContextTag({ children, tone }: { children: React.ReactNode; tone: 'red' | 'amber' }) {
  const cls = tone === 'red' ? 'text-red' : 'text-amber';
  return <div className={`text-xs ${cls}`}>{children}</div>;
}
