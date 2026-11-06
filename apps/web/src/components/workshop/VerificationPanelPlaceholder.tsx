import React from 'react';
import { NeoCard } from '../ui/NeoCard';
import { NeoBadge } from '../ui/NeoBadge';
import { NeoButton } from '../ui/NeoButton';

interface VerificationPanelPlaceholderProps {
  stepSlug: string;
  workshopSlug?: string;
  onOpenStarterModal?: () => void;
}

export function VerificationPanelPlaceholder({
  stepSlug,
  onOpenStarterModal,
}: VerificationPanelPlaceholderProps) {
  return (
    <div className="w-full xl:w-80 shrink-0 space-y-4">
      <NeoCard shadow="md" className="overflow-hidden">
        {/* Panel Header */}
        <div className="bg-theme-pink border-b-2 border-black p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-black">
              Verification Engine
            </span>
            <NeoBadge variant="white" className="text-[10px] font-bold">
              Actions OIDC
            </NeoBadge>
          </div>
          <h3 className="text-base font-extrabold text-black">
            Automated CI Verification
          </h3>
        </div>

        {/* Panel Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs font-sans text-theme-muted leading-relaxed">
          <p>
            No browser IDE. Push your local solution to your linked GitHub repository.
            The official server computes pass/fail verdicts and updates this view via SSE.
          </p>

          {/* Terminal Box */}
          <div className="bg-black text-slate-100 p-3.5 rounded-[2px] border-2 border-black font-mono text-[11px] space-y-1">
            <div className="text-slate-400"># Push to trigger verification:</div>
            <div>git add .</div>
            <div>git commit -m &quot;implement {stepSlug}&quot;</div>
            <div className="text-emerald-400 font-bold">git push origin main</div>
          </div>

          {/* Status Box */}
          <div className="p-3 bg-theme-bg rounded-[2px] border-2 border-black space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-black">
              <span className="font-bold">Status:</span>
              <span className="bg-theme-green text-black border border-black font-bold px-1.5 py-0.5 rounded-[2px] text-[10px]">
                Ready to Push
              </span>
            </div>
            <div className="flex items-center justify-between text-black">
              <span className="font-bold">Audience:</span>
              <span className="text-black font-bold">handrail-api</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              disabled
              className="w-full py-2 px-3 text-xs font-mono font-bold border-2 border-black bg-stone-100 text-stone-400 rounded-[2px] cursor-not-allowed select-none"
            >
              Awaiting Git Push...
            </button>

            {onOpenStarterModal && (
              <NeoButton
                variant="yellow"
                size="sm"
                onClick={onOpenStarterModal}
                className="w-full text-xs"
              >
                📦 Download Starter Package
              </NeoButton>
            )}
          </div>
        </div>
      </NeoCard>
    </div>
  );
}
