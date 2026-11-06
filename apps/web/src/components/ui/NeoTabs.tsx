import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
}

export interface NeoTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
}

export function NeoTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: NeoTabsProps<T>) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
            className={`px-3 py-1 text-xs font-mono font-semibold border-2 border-black rounded-[2px] transition-all cursor-pointer ${
              isActive
                ? 'bg-theme-yellow text-black font-bold shadow-none'
                : 'bg-white hover:bg-slate-100 text-black'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

