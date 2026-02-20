import { useEffect, useRef, useState } from 'react';
import { ViewStateService, ViewStateData } from './view-state.service';

/**
 * React hook for OpenFin view state persistence.
 *
 * @returns `[service, restoredState, isRestored]`
 *  - `service`       – the ViewStateService instance (stable across renders)
 *  - `restoredState` – the state object read from the previous snapshot
 *  - `isRestored`    – `true` once `restoreState()` has completed
 */
export function useViewState(): [ViewStateService, ViewStateData, boolean] {
  const serviceRef = useRef<ViewStateService>(new ViewStateService());
  const [restoredState, setRestoredState] = useState<ViewStateData>({});
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    const svc = serviceRef.current;

    svc.restoreState().then((state) => {
      setRestoredState(state);
      setIsRestored(true);
    });

    return () => {
      svc.destroy();
    };
  }, []);

  return [serviceRef.current, restoredState, isRestored];
}
