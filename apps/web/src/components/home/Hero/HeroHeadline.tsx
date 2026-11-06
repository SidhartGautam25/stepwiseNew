import React from 'react';

export interface HeroHeadlineProps {
  description?: string;
  className?: string;
}

export function HeroHeadline({
  description = 'Pick a workshop, download the starter in your language, and build it yourself. Push to GitHub and the tests tell you exactly where you stand.',
  className = '',
}: HeroHeadlineProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <h1 className="text-3xl sm:text-4xl lg:text-[2.55rem] xl:text-[2.85rem] font-black tracking-tight text-black leading-[1.15]">
        Build real software,
        <br />
        <span className="inline-block bg-theme-yellow border-2 sm:border-3 border-black px-2.5 py-0.5 mr-2.5 align-middle shadow-none">
          one step
        </span>
        at a time.
      </h1>

      <p className="max-w-md text-xs sm:text-sm text-black/80 font-medium leading-relaxed">
        {description}
      </p>
    </div>
  );
}
