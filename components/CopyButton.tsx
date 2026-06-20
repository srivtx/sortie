'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  value: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  onCopy?: () => void;
}

export default function CopyButton({ value, label, size = 'sm', className = '', onCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.();
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for non-HTTPS or no clipboard API
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); onCopy?.(); } catch {}
      document.body.removeChild(ta);
      timer.current = setTimeout(() => setCopied(false), 1500);
    }
  };

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded border transition font-mono ${
        copied
          ? 'border-green text-green bg-green/10'
          : 'border-line text-dim hover:text-ink hover:border-line2 hover:bg-surface2'
      } ${sizeClasses} ${className}`}
      title={`Copy ${label || 'value'}`}
    >
      {copied ? (
        <>
          <Check className={iconSize} />
          <span>copied</span>
        </>
      ) : (
        <>
          <Copy className={iconSize} />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
}
