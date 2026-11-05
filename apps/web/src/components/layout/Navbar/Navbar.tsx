'use client';

import React from 'react';
import { useNavbar } from '../../../hooks/use-navbar';
import { NavBrand } from './NavBrand';
import { NavLinks } from './NavLinks';
import { NavActions } from './NavActions';

export interface NavbarProps {
  className?: string;
}

export function Navbar({ className = '' }: NavbarProps) {
  const {
    links,
    isAuthenticated,
    handleLoginClick,
    handleGetStartedClick,
  } = useNavbar();

  return (
    <header
      className={`w-full bg-theme-bg border-b-2 border-black px-6 sm:px-12 py-3.5 sticky top-0 z-40 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand Logo */}
        <NavBrand />

        {/* Center: Navigation Links */}
        <div className="hidden md:flex items-center">
          <NavLinks links={links} />
        </div>

        {/* Right: Auth Actions */}
        <NavActions
          isAuthenticated={isAuthenticated}
          onLogin={handleLoginClick}
          onGetStarted={handleGetStartedClick}
        />
      </div>
    </header>
  );
}

