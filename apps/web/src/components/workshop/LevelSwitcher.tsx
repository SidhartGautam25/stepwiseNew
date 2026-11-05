'use client';

import React from 'react';
import { useLevelPreference } from '../../hooks/use-level-preference';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
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
      <div className="inline-flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 gap-1">
        {availableLevels.map((lvl) => {
          const meta = getLevelMetadata(lvl);
          const isActive = level === lvl;
          return (
            <Button
              key={lvl}
              size="sm"
              variant={isActive ? 'emerald' : 'ghost'}
              onClick={() => setLevel(lvl)}
              className={`capitalize transition-all ${
                isActive
                  ? 'shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {meta.label}
            </Button>
          );
        })}
      </div>

      {showDescription && (
        <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
          <Badge variant={getLevelMetadata(level).badgeVariant}>
            {getLevelMetadata(level).label} Depth
          </Badge>
          <span className="truncate">{getLevelMetadata(level).fullDesc}</span>
        </div>
      )}
    </div>
  );
}
