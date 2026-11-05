'use client';

import { useUIStore } from '../stores/ui-store';
import { CONTENT_LEVELS, LEVEL_LIST, LevelMetadata } from '../config/content-levels';
import type { ContentLevel } from '@app/contracts';

export interface UseLevelPreferenceReturn {
  level: ContentLevel;
  metadata: LevelMetadata;
  setLevel: (newLevel: ContentLevel) => void;
  availableLevels: ContentLevel[];
  getLevelMetadata: (lvl: ContentLevel) => LevelMetadata;
}

export function useLevelPreference(workshopSlug?: string): UseLevelPreferenceReturn {
  const { globalLevel, setGlobalLevel, setWorkshopLevel, getLevelForWorkshop } =
    useUIStore();

  const currentLevel = getLevelForWorkshop(workshopSlug);

  const setLevel = (newLevel: ContentLevel) => {
    if (workshopSlug) {
      setWorkshopLevel(workshopSlug, newLevel);
    } else {
      setGlobalLevel(newLevel);
    }
  };

  return {
    level: currentLevel,
    metadata: CONTENT_LEVELS[currentLevel],
    setLevel,
    availableLevels: LEVEL_LIST,
    getLevelMetadata: (lvl: ContentLevel) => CONTENT_LEVELS[lvl],
  };
}

