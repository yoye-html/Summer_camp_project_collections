import React from 'react';
import { cn } from '@/lib/utils';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'destructive' | 'mega';
  children: React.ReactNode;
  ariaLabel?: string;
  isListening?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}

export function AccessibleButton({
  variant = 'primary',
  children,
  className,
  ariaLabel,
  isListening,
  disabled,
  ...props
}: AccessibleButtonProps) {
  const baseClasses = {
    primary: 'btn-primary-large',
    secondary: 'btn-secondary-large',
    success: 'btn-success-large',
    destructive: 'btn-destructive-large',
    mega: cn('btn-mega', isListening && 'listening'),
  };

  return (
    <button
      className={cn(
        baseClasses[variant],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
