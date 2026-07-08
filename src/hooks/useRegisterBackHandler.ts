import { useEffect } from 'react';
import { registerBackHandler, unregisterBackHandler } from '../utils/backButtonRegistry';

/**
 * Custom React hook to register a hardware back button handler inside any component.
 * Automatically handles registration on mount, updating on dependency changes, and unregistering on unmount.
 * 
 * @param handler Function returning true if back press is handled/consumed, false to propagate further.
 * @param priority Higher priority handlers are executed first. Defaults to 10.
 * @param deps Dependency array to re-register the handler when states change.
 */
export function useRegisterBackHandler(
  handler: () => boolean,
  priority: number = 10,
  deps: any[] = []
) {
  useEffect(() => {
    // Generate a unique id for this hook instance
    const id = `back_h_${Math.random().toString(36).substring(2, 9)}`;
    
    registerBackHandler(id, handler, priority);
    
    return () => {
      unregisterBackHandler(id);
    };
  }, deps);
}
