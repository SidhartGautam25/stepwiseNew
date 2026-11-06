'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { NeoButton } from '../ui/NeoButton';
import { NeoBadge } from '../ui/NeoBadge';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white border-3 border-black shadow-hard-xl rounded-[2px] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b-2 border-black bg-theme-yellow flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <NeoBadge variant="white" className="font-mono text-xs font-bold uppercase">
                {starterInfo.language} STARTER
              </NeoBadge>
              <span className="text-xs font-mono font-bold text-black">
                Archive • {formattedSize}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-black tracking-tight">
              Ready to Build: {starterInfo.workshopSlug}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="border-2 border-black bg-white hover:bg-slate-100 p-1.5 rounded-[2px] font-bold text-black text-sm cursor-pointer shadow-hard-sm active:shadow-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step 1: Download Button */}
          <div className="p-5 bg-theme-bg border-2 border-black rounded-[2px] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-black uppercase tracking-tight">
                  Step 1: Download Starter Package
                </h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  Pre-configured boilerplate with pinned verification workflow.
                </p>
              </div>
              <a
                href={starterInfo.downloadUrl}
                download={`${starterInfo.workshopSlug}-${starterInfo.language}-starter.zip`}
                className="inline-block"
              >
                <NeoButton variant="yellow" size="md">
                  ⬇ Download .zip ({formattedSize})
                </NeoButton>
              </a>
            </div>

            <div className="text-[11px] font-mono font-bold text-black flex items-center gap-2 bg-white p-2 border border-black rounded-[2px] overflow-x-auto">
              <span className="shrink-0 text-theme-muted uppercase">SHA-256:</span>
              <span className="truncate">{starterInfo.checksum}</span>
            </div>
          </div>

          {/* Step 2: Git Init & Push Instructions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-black uppercase tracking-tight">
                Step 2: Initialize Git & Connect Repository
              </h3>
              <button
                type="button"
                onClick={copyToClipboard}
                className="px-3 py-1 text-xs font-mono font-bold border-2 border-black rounded-[2px] bg-white hover:bg-slate-100 text-black shadow-hard-sm active:shadow-none cursor-pointer"
              >
                {copied ? '✓ Copied!' : '📋 Copy Commands'}
              </button>
            </div>

            <div className="bg-black text-slate-100 rounded-[2px] p-4 border-2 border-black font-mono text-xs leading-relaxed overflow-x-auto">
              <pre className="whitespace-pre">{terminalCommands}</pre>
            </div>
          </div>

          {/* Verification Callout */}
          <div className="p-4 bg-theme-blue/30 border-2 border-black rounded-[2px] space-y-1.5 text-xs text-black">
            <div className="flex items-center gap-2 font-extrabold">
              <span className="text-base">⚡</span>
              <span className="uppercase font-mono">Automated Verification via GitHub Actions</span>
            </div>
            <p className="leading-relaxed">
              Your starter repository includes{' '}
              <code className="text-black bg-white px-1.5 py-0.5 rounded-[2px] font-mono font-bold border border-black">
                .github/workflows/verify.yml
              </code>
              . Each time you push commits to <code className="font-mono font-bold">main</code>,
              Handrail runs official black-box assertions against your code and updates your
              progress live in the web interface.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-black bg-theme-bg flex items-center justify-between">
          <NeoButton variant="ghost" size="sm" onClick={onClose}>
            Close
          </NeoButton>

          {firstStepUrl && (
            <Link href={firstStepUrl} onClick={onClose}>
              <NeoButton variant="yellow" size="md">
                {firstStepTitle} →
              </NeoButton>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

