import type { OverviewSections } from '../schemas/snapshot.schema.js';

export interface OverviewParseResult {
  sections: OverviewSections;
  missingSections: string[];
}

export function parseOverviewMarkdown(rawContent: string): OverviewParseResult {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const sectionMap: Record<string, string[]> = {
    whatWeBuild: [],
    whatYouLearn: [],
    prerequisites: [],
    limitations: [],
    howItWorks: [],
  };

  let currentKey: keyof typeof sectionMap | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^##\s+(.+)$/);

    if (match) {
      const headingText = match[1].trim().toLowerCase();
      if (headingText.includes('what we build')) {
        currentKey = 'whatWeBuild';
      } else if (headingText.includes('what you will learn') || headingText.includes('what you learn')) {
        currentKey = 'whatYouLearn';
      } else if (headingText.includes('prerequisites') || headingText.includes('prerequisite')) {
        currentKey = 'prerequisites';
      } else if (headingText.includes('limitations and scope') || headingText.includes('limitations')) {
        currentKey = 'limitations';
      } else if (headingText.includes('how this workshop works') || headingText.includes('how it works')) {
        currentKey = 'howItWorks';
      } else {
        currentKey = null;
      }
      continue;
    }

    if (currentKey) {
      sectionMap[currentKey].push(line);
    }
  }

  const missingSections: string[] = [];
  const sections: Record<string, string> = {};

  const keys: Array<{ key: keyof typeof sectionMap; name: string }> = [
    { key: 'whatWeBuild', name: 'What we build' },
    { key: 'whatYouLearn', name: 'What you will learn' },
    { key: 'prerequisites', name: 'Prerequisites' },
    { key: 'limitations', name: 'Limitations and scope' },
    { key: 'howItWorks', name: 'How this workshop works' },
  ];

  for (const { key, name } of keys) {
    const text = sectionMap[key].join('\n').trim();
    if (!text) {
      missingSections.push(name);
    } else {
      sections[key] = text;
    }
  }

  return {
    sections: sections as OverviewSections,
    missingSections,
  };
}
