'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import type { StarterInfoResponseDto } from '@app/contracts';

interface StarterDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  starterInfo: StarterInfoResponseDto | null;
  firstStepUrl?: string;
  firstStepTitle?: string;
}

export function StarterDownloadModal({
  isOpen,
  onClose,
  starterInfo,
  firstStepUrl,
  firstStepTitle = 'Start Step 1',
}: StarterDownloadModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !starterInfo) {
    return null;
  }

  const terminalCommands = [
    `# 1. Unpack the downloaded starter template`,
    `unzip ${starterInfo.workshopSlug}-${starterInfo.language}-starter.zip`,
    `cd ${starterInfo.workshopSlug}-${starterInfo.language}`,
    ``,
    `# 2. Initialize Git and make your initial commit`,
    `${starterInfo.instructions.gitInit}`,
    `${starterInfo.instructions.gitAdd}`,
    `${starterInfo.instructions.gitCommit}`,
    ``,
    `# 3. Connect your GitHub repository`,
    `${starterInfo.instructions.gitBranch}`,
    `${starterInfo.instructions.gitRemote}`,
    ``,
    `# 4. Push to trigger Handrail verification`,
    `${starterInfo.instructions.gitPush}`,
  ].join('\n');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(terminalCommands);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedSize =
    starterInfo.fileSize > 1024
      ? `${(starterInfo.fileSize / 1024).toFixed(1)} KB`
      : `${starterInfo.fileSize} B`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="emerald">{starterInfo.language.toUpperCase()}</Badge>
              <span className="text-xs font-mono text-slate-400">
                Starter Archive • {formattedSize}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Ready to Build: {starterInfo.workshopSlug}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step 1: Download Button */}
          <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-emerald-300">
                  Step 1: Download Starter Package
                </h3>
                <p className="text-xs text-slate-400">
                  Pre-configured boilerplate with pinned verification workflow.
                </p>
              </div>
              <a
                href={starterInfo.downloadUrl}
                download={`${starterInfo.workshopSlug}-${starterInfo.language}-starter.zip`}
                className="inline-block"
              >
                <Button variant="primary" size="md" className="shadow-lg shadow-emerald-500/20">
                  ⬇ Download .zip ({formattedSize})
                </Button>
              </a>
            </div>

            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 truncate">
              <span>SHA-256:</span>
              <span className="text-slate-400 truncate">{starterInfo.checksum}</span>
            </div>
          </div>

          {/* Step 2: Git Init & Push Instructions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
                Step 2: Initialize Git & Push to GitHub
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="text-xs font-mono h-7 px-2.5"
              >
                {copied ? '✓ Copied!' : '📋 Copy Commands'}
              </Button>
            </div>

            <div className="relative bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
              <pre className="whitespace-pre">{terminalCommands}</pre>
            </div>
          </div>

          {/* Verification Engine Callout */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <span className="text-emerald-400">⚡</span>
              <span>Automated Verification via GitHub Actions</span>
            </div>
            <p>
              Your starter repository includes{' '}
              <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded font-mono">
                .github/workflows/verify.yml
              </code>
              . Each time you push commits to <code className="text-slate-300 font-mono">main</code>,
              Handrail runs official black-box assertions against your code and updates your
              progress live in the web interface.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          {firstStepUrl && (
            <Link href={firstStepUrl} onClick={onClose}>
              <Button variant="primary" size="md">
                {firstStepTitle} →
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

