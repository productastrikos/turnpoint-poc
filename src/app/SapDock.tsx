import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

const VIRTUAL_WIDTH = 1100; // the console renders at this width and is scaled into the dock, so its text stays readable

/**
 * The SAP S/4HANA stand-in docked beside the OQ page, so a scope item created in OQ can be seen arriving in SAP on the
 * same screen. The frame stays mounted while the dock is closed, so SAP keeps its state and keeps listening to the
 * integration bus: orders created in OQ are never lost because the panel happened to be closed.
 */
export function SapDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const body = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 640, h: 700 });
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = box.w > 0 ? box.w / VIRTUAL_WIDTH : 1;
  return (
    <aside className={`sap-dock no-print ${open ? 'open' : ''}`} aria-label="SAP S/4HANA side by side" aria-hidden={!open}>
      <div className="sap-dock-head">
        <strong>SAP S/4HANA</strong>
        <span className="sap-dock-sub">stand-in · receives from OQ live</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close SAP view" title="Close SAP view">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="sap-dock-body" ref={body}>
        <iframe src="/ext/sap?compact=1&tab=orders" title="SAP S/4HANA (stand-in)" style={{ width: VIRTUAL_WIDTH, height: scale > 0 ? box.h / scale : box.h, transform: `scale(${scale})` }} />
      </div>
    </aside>
  );
}
