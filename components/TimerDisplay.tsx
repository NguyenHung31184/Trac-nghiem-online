import React from 'react';
import { ClockIcon } from './icons/ClockIcon';

interface TimerDisplayProps {
  timeLeft: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeLeft }) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const isLowTime = timeLeft < 300; // less than 5 minutes

  return (
    <div className={`p-4 rounded-lg flex items-center justify-center space-x-3 ${isLowTime ? 'bg-rose-100' : 'bg-indigo-100'}`}>
        <ClockIcon className={`h-6 w-6 ${isLowTime ? 'text-rose-600' : 'text-indigo-600'}`}/>
        <div className="text-center">
            <p className={`text-sm font-bold uppercase tracking-wider ${isLowTime ? 'text-rose-700' : 'text-indigo-700'}`}>Thời gian còn lại</p>
            <p className={`text-3xl font-mono font-bold tracking-wider ${isLowTime ? 'text-rose-900' : 'text-indigo-900'}`}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
        </div>
    </div>
  );
};

export default TimerDisplay;