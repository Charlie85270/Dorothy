'use client';

import { useState, useCallback } from 'react';

export function useBroadcast() {
  const [broadcastMode, setBroadcastMode] = useState(false);

  const toggleBroadcast = useCallback(() => {
    setBroadcastMode(prev => !prev);
  }, []);

  const enableBroadcast = useCallback(() => {
    setBroadcastMode(true);
  }, []);

  const disableBroadcast = useCallback(() => {
    setBroadcastMode(false);
  }, []);

  return {
    broadcastMode,
    toggleBroadcast,
    enableBroadcast,
    disableBroadcast,
  };
}
