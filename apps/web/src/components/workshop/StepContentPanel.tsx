'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { LevelSwitcher } from './LevelSwitcher';
import type { StepDetailDto, ContentLevel, StepTestDto } from '@app/contracts';

interface StepContentPanelProps {
  step: StepDetailDto;
  workshopSlug: string;
  activeLevel: ContentLevel;
  taskMdx: string;
  theoryMdx: string;
  hintsMdx?: string;
  tests: StepTestDto[];
}

export function StepContentPanel({
  step,
  workshopSlug,
  activeLevel,
  taskMdx,
  theoryMdx,
  hintsMdx,
  tests,
}: StepContentPanelProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'theory' | 'hints' | 'tests'>('task');

  const tabs = [
    { id: 'task' as const, label: 'Task' },
    { id: 'theory' as const, label: 'Theory' },
    {
      id: 'hints' as const,
      label: 'Hints',
      badge: hintsMdx ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ) : undefined,
    },
    {
      id: 'tests' as const,
      label: 'Test Suite',
      badge: (
        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded-full">
          {tests.length}
        </span>
      ),
    },
  ];

  return (
    <div className="flex-1 space-y-6">
      {/* Step Header */}
      <Card className="border-slate-800 bg-slate-900/40">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Step {step.globalOrder}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                Unit of Work & Verification
              </span>
            </div>
            <CardTitle className="text-2xl">{step.title}</CardTitle>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-slate-500 uppercase">Live Depth</div>
              <div className="text-xs font-semibold capitalize text-emerald-400">
                {activeLevel}
              </div>
            </div>
            <LevelSwitcher workshopSlug={workshopSlug} />
          </div>
        </CardHeader>

        <div className="px-6 pt-2 pb-0">
          <Tabs items={tabs} activeId={activeTab} onChange={setActiveTab} size="sm" />
        </div>

        <CardContent className="pt-6">
          {activeTab === 'task' && (
            <div className="prose prose-invert max-w-none space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                <span>
                  Showing <strong className="capitalize text-emerald-400">{activeLevel}</strong> task requirements.
                </span>
                <Badge variant="outline">Live Switcher Active</Badge>
              </div>
              <div className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                {taskMdx}
              </div>
            </div>
          )}

          {activeTab === 'theory' && (
            <div className="prose prose-invert max-w-none space-y-4">
              <div className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                {theoryMdx}
              </div>
            </div>
          )}

          {activeTab === 'hints' && (
            <div className="space-y-4">
              {hintsMdx ? (
                <div className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
                  {hintsMdx}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No hints required for this level. Refer to the Theory tab or RFC specification.
                </div>
              )}
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 mb-2">
                Every step carries its own set of automated tests verified against your running server process.
              </div>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {tests.map((t) => (
                  <div
                    key={t.testId}
                    className="p-3.5 bg-slate-950/40 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-semibold text-slate-200">
                        {t.testId}
                      </div>
                      <div className="text-xs text-slate-400">{t.description}</div>
                    </div>
                    <Badge variant={t.isHidden ? 'default' : 'emerald'}>
                      {t.isHidden ? 'Hidden Test' : 'Visible Test'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
