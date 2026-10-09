import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

export function useLive(query, deps) {
  const [value, setValue] = useState(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: () => setValue([]) });
    return () => sub.unsubscribe();
  }, deps);
  return value;
}
