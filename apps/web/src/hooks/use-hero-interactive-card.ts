import { useState } from 'react';
import type { ContentLevel } from '@app/contracts';
import type { TabItem } from '../components/ui/NeoTabs';
import type { TerminalLine } from '../components/ui/NeoTerminal';

export interface LevelExplanation {
  title: string;
  description: string;
}

export function useHeroInteractiveCard() {
  const [activeLevel, setActiveLevel] = useState<ContentLevel>('beginner');

  const tabs: TabItem<ContentLevel>[] = [
    { id: 'beginner', label: 'Beginner' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'expert', label: 'Expert' },
  ];

  const explanations: Record<ContentLevel, LevelExplanation> = {
    beginner: {
      title: 'Open a TCP port and wait',
      description:
        'Think of your computer as an apartment building. A port is a door number. In this step your program claims door 6379 and waits for someone to knock. We will write the few lines that do it, and explain every word.',
    },
    intermediate: {
      title: 'Bind TCP socket to 0.0.0.0:6379',
      description:
        'Initialize a standard TCP socket listener bound to port 6379. Configure SO_REUSEADDR to avoid address collision during server restart, and enter the connection accept loop.',
    },
    expert: {
      title: 'Implement socket(2), bind(2), listen(2)',
      description:
        'Construct an AF_INET SOCK_STREAM socket on port 6379 with backlog 128. Accept incoming connections and verify response to ping probes.',
    },
  };

  const terminalLines: TerminalLine[] = [
    { id: '1', type: 'command', text: '$ git push origin main' },
    { id: '2', type: 'verify', text: 'verify: step 1 of 12' },
    { id: '3', type: 'pass', text: 'PASS accepts a connection' },
    { id: '4', type: 'pass', text: 'PASS stays open after connect' },
    { id: '5', type: 'fail', text: 'FAIL handles 2 clients at once' },
    { id: '6', type: 'summary', text: '2/3 tests passed' },
  ];

  return {
    stepLabel: 'step 01 / bind-a-port',
    chapterLabel: 'chapter 1',
    activeLevel,
    setActiveLevel,
    tabs,
    currentExplanation: explanations[activeLevel],
    terminalLines,
  };
}

