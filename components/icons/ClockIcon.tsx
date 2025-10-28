import React from 'react';
import { Icon } from './Icon';

export const ClockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Icon 
    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
    {...props} 
  />
);
