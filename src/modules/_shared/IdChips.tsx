/** P6 Activity ID and SAP work-order chips shown on rows across the app (Simulated integration keys). */
export function IdChips({ p6Id, sapWo, sapNotif }: { p6Id?: string; sapWo?: string; sapNotif?: string }) {
  if (!p6Id && !sapWo && !sapNotif) return null;
  return (
    <span className="row-wrap" style={{ gap: 4, marginTop: 2 }}>
      {p6Id && (
        <span className="tag-chip p6" title="Primavera P6 Activity ID. Source: P6 import, last sync 2 min ago (simulated)">
          P6 {p6Id}
        </span>
      )}
      {sapWo && (
        <span className="tag-chip sap" title="SAP maintenance order. Source: SAP S/4HANA PM, last sync 4 min ago (simulated)">
          WO {sapWo}
        </span>
      )}
      {sapNotif && (
        <span className="tag-chip sap" title="SAP maintenance notification (simulated)">
          NT {sapNotif}
        </span>
      )}
    </span>
  );
}
