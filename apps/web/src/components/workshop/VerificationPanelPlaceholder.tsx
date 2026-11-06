import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

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
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verification Engine
            </span>
            <Badge variant="amber">Phase 1: Actions</Badge>
          </div>
          <CardTitle className="text-base">GitHub Actions Verification</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-xs text-slate-400">
          <p>
            No browser IDE. Push your local solution to your linked GitHub repository.
            The official server computes pass/fail verdicts and updates this view via SSE.
          </p>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
            <div className="text-slate-500"># Push to trigger verification</div>
            <div>git add .</div>
            <div>git commit -m &quot;implement {stepSlug}&quot;</div>
            <div className="text-emerald-400">git push origin main</div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span>Status:</span>
              <span className="font-mono text-emerald-400">Ready to Push</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Audience:</span>
              <span className="font-mono text-slate-400">handrail-api</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Button variant="outline" size="sm" className="w-full text-slate-400" disabled>
              Awaiting Git Push...
            </Button>

            {onOpenStarterModal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenStarterModal}
                className="w-full text-xs text-emerald-400 hover:text-emerald-300"
              >
                📦 Download Starter & Git Instructions
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
