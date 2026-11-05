import React from 'react';

export interface TerminalLine {
  id: string;
  type: 'command' | 'verify' | 'pass' | 'fail' | 'summary';
  text: string;
}

export interface NeoTerminalProps {
  lines?: TerminalLine[];
  className?: string;
}

const DEFAULT_LINES: TerminalLine[] = [
  { id: '1', type: 'command', text: '$ git push origin main' },
  { id: '2', type: 'verify', text: 'verify: step 1 of 12' },
  { id: '3', type: 'pass', text: 'PASS accepts a connection' },
  { id: '4', type: 'pass', text: 'PASS stays open after connect' },
  { id: '5', type: 'fail', text: 'FAIL handles 2 clients at once' },
  { id: '6', type: 'summary', text: '2/3 tests passed' },
];

export function NeoTerminal({
  lines = DEFAULT_LINES,
  className = '',
}: NeoTerminalProps) {
  return (
    <div
      className={`bg-black text-slate-100 font-mono text-[11px] sm:text-xs p-3 sm:p-3.5 rounded-[2px] border-2 border-black shadow-inner leading-normal ${className}`}
    >
      {lines.map((line) => {
        if (line.type === 'command') {
          return (
            <div key={line.id} className="text-white font-bold mb-0.5">
              {line.text}
            </div>
          );
        }
        if (line.type === 'verify') {
          return (
            <div key={line.id} className="text-emerald-400 mb-0.5">
              {line.text}
            </div>
          );
        }
        if (line.type === 'pass') {
          return (
            <div key={line.id} className="text-emerald-400">
              <span className="font-bold">PASS</span> {line.text.replace(/^PASS\s*/, '')}
            </div>
          );
        }
        if (line.type === 'fail') {
          return (
            <div key={line.id} className="text-rose-400">
              <span className="font-bold">FAIL</span> {line.text.replace(/^FAIL\s*/, '')}
            </div>
          );
        }
        return (
          <div key={line.id} className="text-slate-300 font-semibold mt-0.5">
            {line.text}
          </div>
        );
      })}
    </div>
  );
}
