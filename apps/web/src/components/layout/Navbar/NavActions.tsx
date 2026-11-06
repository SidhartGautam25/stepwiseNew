import React from 'react';
import { NeoButton } from '../../ui/NeoButton';

export interface NavActionsProps {
  isAuthenticated: boolean;
  onLogin: () => void;
  onGetStarted: () => void;
  className?: string;
}

export function NavActions({
  isAuthenticated,
  onLogin,
  onGetStarted,
  className = '',
}: NavActionsProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <NeoButton variant="white" size="sm" onClick={onLogin}>
        {isAuthenticated ? 'Sign out' : 'Log in'}
      </NeoButton>
      <NeoButton variant="yellow" size="sm" onClick={onGetStarted}>
        Get started
      </NeoButton>
    </div>
  );
}

