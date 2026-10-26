import React from 'react';

interface SkipLinkProps {
  targetId: string;
  label?: string;
}

export function SkipLink({ targetId, label = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
    >
      {label}
    </a>
  );
}
