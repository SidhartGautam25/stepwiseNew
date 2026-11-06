'use client';

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'emerald'
  | 'yellow'
  | 'white'
  | 'pink';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-theme-yellow hover:bg-[#ffe373] text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
  yellow:
    'bg-theme-yellow hover:bg-[#ffe373] text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
  secondary:
    'bg-white hover:bg-slate-50 text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
  white:
    'bg-white hover:bg-slate-50 text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
  emerald:
    'bg-theme-green hover:bg-[#3ec772] text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
  pink:
    'bg-theme-pink hover:bg-[#fca5a5] text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
  outline:
    'bg-transparent hover:bg-black/5 text-black border-2 border-black shadow-hard-sm active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
  ghost:
    'bg-transparent hover:bg-black/5 text-black border-2 border-transparent shadow-none',
  danger:
    'bg-theme-red hover:bg-[#ef4444] text-black border-2 border-black shadow-hard-md active:shadow-hard-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3.5 py-1.5 font-bold rounded-[2px] gap-1.5',
  md: 'text-sm px-5 py-2.5 font-bold rounded-[2px] gap-2',
  lg: 'text-base px-7 py-3 font-extrabold rounded-[2px] gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
            variantStyles[variant],
            sizeStyles[size],
            className,
          ),
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';

