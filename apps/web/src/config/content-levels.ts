import type { ContentLevel } from '@app/contracts';

export interface LevelMetadata {
  id: ContentLevel;
  label: string;
  shortDesc: string;
  fullDesc: string;
  badgeVariant: 'beginner' | 'intermediate' | 'expert';
}

export const CONTENT_LEVELS: Record<ContentLevel, LevelMetadata> = {
  beginner: {
    id: 'beginner',
    label: 'Beginner',
    shortDesc: 'Step-by-step guidance',
    fullDesc: 'Assumes zero prior network or protocol experience. Includes detailed walkthroughs and syntax hints.',
    badgeVariant: 'beginner',
  },
  intermediate: {
    id: 'intermediate',
    label: 'Intermediate',
    shortDesc: 'Idiomatic engineering guide',
    fullDesc: 'Standard professional briefing. Explains protocol nuances with idiomatic patterns and architecture tips.',
    badgeVariant: 'intermediate',
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    shortDesc: 'Terse RFC specifications',
    fullDesc: 'Terse and direct. Exact specification references and invariant constraints with zero hand-holding.',
    badgeVariant: 'expert',
  },
};

export const LEVEL_LIST: ContentLevel[] = ['beginner', 'intermediate', 'expert'];

