import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  rightElement?: React.ReactNode;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ label, error, helperText, rightElement, className, id, ...props }, ref) => {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const ariaDescribedBy = [
      error ? errorId : undefined,
      helperText ? helperId : undefined
    ].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-2">
        <label
          htmlFor={inputId}
          className="block text-accessible font-semibold text-foreground"
        >
          {label}
        </label>

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input-accessible w-full',
              rightElement && 'pr-12',
              error && 'border-destructive focus:border-destructive focus:ring-destructive/30',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={ariaDescribedBy}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightElement}
            </div>
          )}
        </div>

        {helperText && !error && (
          <p id={helperId} className="text-muted-foreground text-base">
            {helperText}
          </p>
        )}

        {error && (
          <p
            id={errorId}
            className="text-destructive text-base font-medium"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';
