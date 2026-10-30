'use client';

import { useEffect } from 'react';
import { applyScreenSecurity } from '@/lib/native-screen-security';

/** Applies the saved screenshot-protection preference to the native window on
 *  launch. Renders nothing; a no-op off native. */
export function ScreenSecurityApplier() {
  useEffect(() => {
    void applyScreenSecurity();
  }, []);
  return null;
}
