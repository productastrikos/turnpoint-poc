import { useEffect } from 'react';

// "Data changed underneath you" signal for open pages, e.g. a scope item that arrived from SAP or dates that moved in a
// P6 reschedule. Pages that hold their own copy of the data listen and reload.
export type DataTopic = 'scope' | 'schedule';

const EVENT = 'turnpoint:data';

export function emitData(topic: DataTopic) {
  window.dispatchEvent(new CustomEvent<DataTopic>(EVENT, { detail: topic }));
}

export function useDataEvent(topic: DataTopic, fn: () => void) {
  useEffect(() => {
    const h = (e: Event) => (e as CustomEvent<DataTopic>).detail === topic && fn();
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, [topic, fn]);
}
