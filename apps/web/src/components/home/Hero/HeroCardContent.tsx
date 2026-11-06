import React from 'react';
import type { ContentLevel } from '@app/contracts';
import type { TabItem } from '../../ui/NeoTabs';
import type { TerminalLine } from '../../ui/NeoTerminal';
import type { LevelExplanation } from '../../../hooks/use-hero-interactive-card';
import { NeoTabs } from '../../ui/NeoTabs';
import { NeoTerminal } from '../../ui/NeoTerminal';

export interface HeroCardContentProps {
  tabs: TabItem<ContentLevel>[];
  activeLevel: ContentLevel;
  onLevelChange: (level: ContentLevel) => void;
  explanation: LevelExplanation;
  terminalLines: TerminalLine[];
}

export function HeroCardContent({
  tabs,
  activeLevel,
  onLevelChange,
  explanation,
  terminalLines,
}: HeroCardContentProps) {
  return (
    <div className="p-4 sm:p-5 space-y-3">
      {/* Level switcher segmented tabs */}
      <div>
        <NeoTabs<ContentLevel>
          tabs={tabs}
          activeTab={activeLevel}
          onChange={onLevelChange}
        />
      </div>

      {/* Title & Adaptive Explanation */}
      <div className="space-y-1.5">
        <h3 className="text-sm sm:text-base font-bold text-black tracking-tight">
          {explanation.title}
        </h3>
        <p className="text-xs text-black/85 leading-relaxed font-normal min-h-[46px]">
          {explanation.description}
        </p>
      </div>

      {/* Terminal Preview */}
      <div>
        <NeoTerminal lines={terminalLines} />
      </div>
    </div>
  );
}
