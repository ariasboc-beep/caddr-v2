import React from 'react';

// Logo Caddr. « La Validation » : le C teal qui s'ouvre sur une coche d'or
export const Logo: React.FC<{ size?: number; framed?: boolean; className?: string }> = ({ size = 40, framed = true, className = '' }) => (
  <svg viewBox="0 0 512 512" width={size} height={size} className={className} role="img" aria-label="Caddr.">
    {framed && <rect width="512" height="512" rx="116" fill="#0E0F10" />}
    <g transform="translate(-6 0)">
      <path d="M 307.8 165.6 A 118 118 0 1 0 307.8 346.4" fill="none" stroke="#2FB0A6" strokeWidth="54" strokeLinecap="round" />
      <polyline points="262,262 305,305 392,206" fill="none" stroke="#FDCA40" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

export default Logo;
