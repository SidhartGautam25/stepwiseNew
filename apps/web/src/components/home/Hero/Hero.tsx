'use client';

import React from 'react';
import { useHero } from '../../../hooks/use-hero';
import { HeroBanner } from './HeroBanner';
import { HeroHeadline } from './HeroHeadline';
import { HeroActions } from './HeroActions';
import { HeroFeaturePills } from './HeroFeaturePills';
import { HeroInteractiveCard } from './HeroInteractiveCard';

export interface HeroProps {
  className?: string;
}

export function Hero({ className = '' }: HeroProps) {
  const {
    bannerText,
    featurePills,
    handleBrowseWorkshops,
    handleReadReviews,
  } = useHero();

  return (
    <section
      className={`w-full max-w-7xl mx-auto px-6 sm:px-12 flex items-center justify-center ${className}`}
    >
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Left Column: Copy, Headline, CTA buttons, and Feature Badges */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-3 sm:space-y-4 lg:space-y-5">
          <HeroBanner text={bannerText} />
          <HeroHeadline />
          <HeroActions
            onBrowse={handleBrowseWorkshops}
            onReviews={handleReadReviews}
          />
          <HeroFeaturePills pills={featurePills} />
        </div>

        {/* Right Column: Live Interactive Neo-Brutalist Step Preview Card */}
        <div className="lg:col-span-5 flex items-center justify-center lg:justify-end">
          <HeroInteractiveCard />
        </div>
      </div>
    </section>
  );
}
