'use client';

import React, { useState } from 'react';
import { NeoCard } from '../ui/NeoCard';
import { NeoBadge } from '../ui/NeoBadge';
import { NeoTabs } from '../ui/NeoTabs';
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
    { id: 'task' as const, label: 'Task Specification' },
    { id: 'theory' as const, label: 'Theory & Protocols' },
    {
      id: 'hints' as const,
      label: hintsMdx ? 'Hints (Active)' : 'Hints',
    },
    {
      id: 'tests' as const,
      label: `Test Suite (${tests.length})`,
    },
  ];

  return (
    <div className="flex-1 space-y-6">
      <NeoCard shadow="xl" className="overflow-hidden">
        {/* Step Header with Accent Color Bar */}
        <div className="bg-theme-blue border-b-2 border-black p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <NeoBadge variant="white" className="font-mono text-xs font-bold">
                Step {step.globalOrder}
              </NeoBadge>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-black">
                Unit of Work & Verification
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
              {step.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-mono font-bold text-black uppercase">Live Depth</div>
              <div className="text-xs font-mono font-extrabold capitalize text-black">
                {activeLevel}
              </div>
            </div>
            <LevelSwitcher workshopSlug={workshopSlug} />
          </div>
        </div>

        {/* NeoTabs Navigation */}
        <div className="px-5 sm:px-6 py-3 bg-theme-bg/40 border-b-2 border-black flex items-center">
          <NeoTabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as any)}
          />
        </div>

        {/* Tab Content Panel */}
        <div className="p-5 sm:p-6">
          {activeTab === 'task' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-[2px] bg-theme-yellow/30 border-2 border-black text-xs font-mono font-bold text-black">
                <span>
                  Showing <span className="uppercase underline decoration-2">{activeLevel}</span> requirements.
                </span>
                <NeoBadge variant="white" className="text-[10px]">
                  Live Switcher Active
                </NeoBadge>
              </div>
              <div className="whitespace-pre-wrap font-sans text-sm text-black leading-relaxed bg-white p-5 rounded-[2px] border-2 border-black shadow-hard-sm">
                {taskMdx}
              </div>
            </div>
          )}

          {activeTab === 'theory' && (
            <div className="space-y-4">
              <div className="whitespace-pre-wrap font-sans text-sm text-black leading-relaxed bg-white p-5 rounded-[2px] border-2 border-black shadow-hard-sm">
                {theoryMdx}
              </div>
            </div>
          )}

          {activeTab === 'hints' && (
            <div className="space-y-4">
              {hintsMdx ? (
                <div className="whitespace-pre-wrap font-sans text-sm text-black leading-relaxed bg-theme-bg p-5 rounded-[2px] border-2 border-black shadow-hard-sm">
                  {hintsMdx}
                </div>
              ) : (
                <div className="p-8 text-center text-theme-muted font-mono text-sm border-2 border-dashed border-black rounded-[2px]">
                  No hints required for this level. Refer to the Theory tab or RFC specification.
                </div>
              )}
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-black uppercase tracking-wider">
                acceptance assertions evaluated by handrail verification engine:
              </div>
              <div className="divide-y-2 divide-black border-2 border-black rounded-[2px] overflow-hidden">
                {tests.map((t) => (
                  <div
                    key={t.testId}
                    className="p-3.5 bg-white flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-bold text-black">
                        {t.testId}
                      </div>
                      <div className="text-xs text-theme-muted">{t.description}</div>
                    </div>
                    <NeoBadge variant={t.isHidden ? 'neutral' : 'yellow'} className="text-[10px]">
                      {t.isHidden ? 'Hidden Test' : 'Visible Test'}
                    </NeoBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </NeoCard>
    </div>
  );
}

