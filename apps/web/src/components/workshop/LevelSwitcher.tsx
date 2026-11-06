'use client';

import React from 'react';
import { useLevelPreference } from '../../hooks/use-level-preference';
import { NeoBadge } from '../ui/NeoBadge';
import type { ContentLevel } from '@app/contracts';

interface LevelSwitcherProps {
  workshopSlug?: string;
  showDescription?: boolean;
}

export function LevelSwitcher({
  workshopSlug,
  showDescription = false,
}: LevelSwitcherProps) {
  const { level, setLevel, availableLevels, getLevelMetadata } =
    useLevelPreference(workshopSlug);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="inline-flex items-center bg-white border-2 border-black rounded-[2px] p-1 gap-1 shadow-hard-sm">
        {availableLevels.map((lvl) => {
          const meta = getLevelMetadata(lvl);
          const isActive = level === lvl;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevel(lvl)}
              className={`px-3 py-1 text-xs font-mono font-bold capitalize transition-all rounded-[2px] border-2 cursor-pointer ${
                isActive
                  ? 'bg-theme-yellow text-black border-black shadow-none'
                  : 'bg-white hover:bg-slate-100 text-black border-transparent'
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {showDescription && (
        <div className="flex items-center gap-2 text-xs text-theme-muted px-1 font-mono">
          <NeoBadge variant="yellow" className="text-[10px] font-bold">
            {getLevelMetadata(level).label} Depth
          </NeoBadge>
          <span className="truncate">{getLevelMetadata(level).fullDesc}</span>
        </div>
      )}
    </div>
  );
}

