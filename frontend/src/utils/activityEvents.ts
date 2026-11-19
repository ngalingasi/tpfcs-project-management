import { useEffect, useRef } from 'react';

const EVENT = 'tpfcs:activity-changed';

/** Tell every open list / Gantt / project tab that an activity was changed or deleted. */
export function emitActivityChanged(activityId?: number) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { activityId } }));
}

/** Run `refresh` whenever an activity is changed elsewhere (e.g. in the activity viewer modal). */
export function useActivityChanged(refresh: () => void) {
  const ref = useRef(refresh);
  ref.current = refresh;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
}
