'use client';

import { useState } from 'react';
import { ExecutionIR, ExecutionStep } from '@/lib/ir/types';
import { shorten } from '@/lib/utils';
import { Cpu, AlertCircle, CheckCircle2, ArrowDown } from 'lucide-react';

interface ExecutionTimelineProps {
  ir: ExecutionIR;
}

export default function ExecutionTimeline({ ir }: ExecutionTimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rootSteps = ir.steps;

  return (
    <div className="font-mono text-xs">
      <div className="text-[10px] text-mute mb-3">
        $ sortie timeline · {ir.allSteps.length} steps total · {rootSteps.length} root
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <SummaryStat label="steps" value={String(ir.allSteps.length)} sub={`${rootSteps.length} root`} />
        <SummaryStat label="compute" value={ir.compute.consumed?.toLocaleString() || '?'} sub="CUs" />
        <SummaryStat label="fee" value={formatLamports(ir.fee.total)} sub="lamports" />
        <SummaryStat
          label="protocols"
          value={String(ir.protocols.length)}
          sub={ir.protocols.map(p => p.name).join(', ') || 'none detected'}
        />
      </div>

      <ol className="space-y-0.5">
        {rootSteps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            isLast={i === rootSteps.length - 1}
            expanded={expanded}
            onToggle={() => toggle(step.id)}
            indent={0}
          />
        ))}
      </ol>
    </div>
  );
}

function StepRow({
  step, index, isLast, expanded, onToggle, indent,
}: {
  step: ExecutionStep;
  index: number;
  isLast: boolean;
  expanded: Set<string>;
  onToggle: () => void;
  indent: number;
}) {
  const isExpanded = expanded.has(step.id);
  const isFailed = step.result === 'failure';
  const isProtocol = !!step.protocol;

  return (
    <li>
      <div
        className={`group flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer border border-transparent hover:border-line hover:bg-surface2 ${
          isFailed ? 'bg-red/5' : ''
        }`}
        style={{ paddingLeft: 8 + indent * 16 }}
        onClick={onToggle}
      >
        <span className="text-mute select-none w-4 text-right text-[10px]">{index + 1}</span>
        {isFailed ? (
          <AlertCircle className="w-3 h-3 text-red shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-green shrink-0" />
        )}
        <span className={`shrink-0 w-24 truncate ${isProtocol ? 'text-purple' : 'text-ink'}`}>
          {step.program.shortName}
        </span>
        <span className="text-dim truncate flex-1 min-w-0">
          {step.instruction.semanticSummary || step.instruction.type}
        </span>
        {step.depth > 0 && (
          <span className="text-[10px] text-mute shrink-0">d{step.depth}</span>
        )}
        {step.computeUnits && (
          <span className="text-[10px] text-green shrink-0 hidden sm:inline">
            {step.computeUnits.consumed.toLocaleString()}cu
          </span>
        )}
        {step.children.length > 0 && (
          <span className="text-[10px] text-mute shrink-0">+{step.children.length}</span>
        )}
        <span className="text-mute text-[10px] shrink-0 w-12 text-right">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isFailed && step.error && (
        <div
          className="ml-12 mt-0.5 text-[10px] text-red bg-red/5 border border-red/20 rounded px-2 py-1 font-mono"
          style={{ marginLeft: 8 + indent * 16 + 24 }}
        >
          ! {step.error.name}: {step.error.rawMessage}
        </div>
      )}

      {isExpanded && step.children.length > 0 && (
        <ol className="mt-0.5">
          {step.children.map((child, i) => (
            <StepRow
              key={child.id}
              step={child}
              index={i}
              isLast={i === step.children.length - 1}
              expanded={expanded}
              onToggle={() => {
                // toggle child by id
                if (expanded.has(child.id)) {
                  const next = new Set(expanded);
                  next.delete(child.id);
                  // re-render is handled by parent
                } else {
                  const next = new Set(expanded);
                  next.add(child.id);
                }
              }}
              indent={indent + 1}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-line rounded px-3 py-2 bg-surface">
      <div className="text-[10px] text-mute uppercase tracking-wider">{label}</div>
      <div className="text-ink text-sm mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-dim mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function formatLamports(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return String(n);
}
