
import { useState, useEffect, useCallback } from 'react';
import type { AuditLog } from '../types';

const useProctoring = (onEvent: (event: AuditLog['event'], metadata?: object) => void) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const requestFullScreen = useCallback(() => {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
  }, []);

  // Prevent copy/paste
  useEffect(() => {
    const blockEvent = (e: Event) => {
      e.preventDefault();
      onEvent('copy_paste_blocked');
    };
    
    document.addEventListener('copy', blockEvent);
    document.addEventListener('paste', blockEvent);
    document.addEventListener('cut', blockEvent);
    
    return () => {
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('paste', blockEvent);
      document.removeEventListener('cut', blockEvent);
    };
  }, [onEvent]);
  
  // Full screen change detector
  useEffect(() => {
    const handleFullScreenChange = () => {
        const isCurrentlyFullScreen = document.fullscreenElement != null;
        setIsFullScreen(isCurrentlyFullScreen);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);


  // Blur/focus detector
  useEffect(() => {
    const handleBlur = () => onEvent('focus_lost');
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [onEvent]);

  // Visibility change detector
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onEvent('visibility_hidden');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onEvent]);

  return { requestFullScreen, isFullScreen };
};

export default useProctoring;
