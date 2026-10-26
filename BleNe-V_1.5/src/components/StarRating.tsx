import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  onRate,
  readonly = false,
  size = 'lg',
  label = 'Rating',
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16 sm:w-20 sm:h-20',
  };

  const iconSizes = {
    sm: 20,
    md: 32,
    lg: 40,
  };

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: maxRating }, (_, index) => {
        const starValue = index + 1;
        const isActive = starValue <= rating;

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => onRate?.(starValue)}
            disabled={readonly}
            className={cn(
              'star-button',
              sizeClasses[size],
              isActive ? 'active' : 'inactive',
              readonly && 'cursor-default'
            )}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
            aria-pressed={isActive}
          >
            <Star
              size={iconSizes[size]}
              fill={isActive ? 'currentColor' : 'none'}
              strokeWidth={2}
            />
          </button>
        );
      })}
      <span className="sr-only">
        Current rating: {rating} out of {maxRating} stars
      </span>
    </div>
  );
}
