import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ContentLevel = 'beginner' | 'intermediate' | 'expert';

interface UIState {
  globalLevel: ContentLevel;
  workshopLevels: Record<string, ContentLevel>;
  setGlobalLevel: (level: ContentLevel) => void;
  setWorkshopLevel: (workshopSlug: string, level: ContentLevel) => void;
  getLevelForWorkshop: (workshopSlug?: string) => ContentLevel;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      globalLevel: 'intermediate',
      workshopLevels: {},
      setGlobalLevel: (level) => set({ globalLevel: level }),
      setWorkshopLevel: (workshopSlug, level) =>
        set((state) => ({
          workshopLevels: { ...state.workshopLevels, [workshopSlug]: level },
        })),
      getLevelForWorkshop: (workshopSlug) => {
        if (workshopSlug && get().workshopLevels[workshopSlug]) {
          return get().workshopLevels[workshopSlug];
        }
        return get().globalLevel;
      },
    }),
    {
      name: 'handrail-ui-storage',
    },
  ),
);
