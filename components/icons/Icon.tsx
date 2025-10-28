import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  d: string;
}

export const Icon: React.FC<IconProps> = ({ d, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d={d} />
  </svg>
);
