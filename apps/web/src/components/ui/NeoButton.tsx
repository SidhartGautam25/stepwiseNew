import React from 'react';
import Link from 'next/link';

export type ButtonVariant = 'yellow' | 'white' | 'ghost' | 'pink';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  children: React.ReactNode;
  className?: string;
}

export function NeoButton({
  variant = 'yellow',
  size = 'md',
  href,
  children,
  className = '',
  disabled,
  ...props
}: NeoButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-bold transition-all duration-75 select-none cursor-pointer';

  const variantClasses: Record<ButtonVariant, string> = {
    yellow:
      'bg-theme-yellow hover:bg-[#ffe373] text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
    white:
      'bg-white hover:bg-slate-50 text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
    pink:
      'bg-theme-pink hover:bg-[#fca5a5] text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
    ghost:
      'bg-transparent hover:bg-black/5 text-black border border-transparent shadow-none',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3.5 py-1.5 text-xs font-bold rounded-[2px]',
    md: 'px-5 py-2.5 text-sm font-bold rounded-[2px]',
    lg: 'px-7 py-3 text-base font-extrabold rounded-[2px]',
  };

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed pointer-events-none'
    : '';

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={combinedClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button className={combinedClasses} disabled={disabled} {...props}>
      {children}
    </button>
  );
}

