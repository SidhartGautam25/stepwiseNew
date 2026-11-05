import React from 'react';

export interface NeoCardProps {
  children: React.ReactNode;
  className?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export function NeoCard({
  children,
  className = '',
  shadow = 'xl',
}: NeoCardProps) {
  const shadowClasses = {
    none: '',
    sm: 'shadow-hard-sm',
    md: 'shadow-hard-md',
    lg: 'shadow-hard-lg',
    xl: 'shadow-hard-xl',
  };

  return (
    <div
      className={`bg-white border-2 border-black rounded-[2px] ${shadowClasses[shadow]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

