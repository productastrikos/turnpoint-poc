// Vendor / shipment tracking for material lines (P7, P8). Keyed by MTO id.
export type ShipStatus = 'Not requested' | 'PR raised' | 'In production' | 'Shipped' | 'At port' | 'Received';

export interface ProcLine {
  id: string; // = MTO id
  vendor: string;
  po?: string;
  ship: ShipStatus;
  eta?: string;
  expedited: boolean;
  receivedOn?: string;
}

// [id, vendor, po, ship, eta, receivedOn]
type R = [string, string, string | undefined, ShipStatus, string | undefined, string | undefined];

const rows: R[] = [
  ['MTO-001', 'Sohar Gasket Co', '4500081120', 'Received', undefined, '2026-08-12'],
  ['MTO-002', 'Sulzer Chemtech', '4500079301', 'In production', '2026-08-19', undefined],
  ['MTO-003', 'Siemens Energy', '4500079422', 'Shipped', '2026-08-20', undefined],
  ['MTO-004', 'Heat Transfer Industries', undefined, 'PR raised', undefined, undefined],
  ['MTO-005', 'Emerson Process', '4500080012', 'Received', undefined, '2026-08-09'],
  ['MTO-006', 'Haldor Topsoe', '4500079655', 'At port', '2026-08-22', undefined],
  ['MTO-007', 'Oman Cables Industry', undefined, 'Not requested', undefined, undefined],
  ['MTO-008', 'Emerson Process', undefined, 'PR raised', undefined, undefined],
  ['MTO-009', 'Axens', '4500078840', 'Shipped', '2026-08-22', undefined],
  ['MTO-010', 'John Zink Hamworthy', undefined, 'PR raised', undefined, undefined],
  ['MTO-011', 'Koch-Glitsch', '4500079120', 'Shipped', '2026-08-17', undefined],
  ['MTO-012', 'Sulzer Chemtech', '4500079302', 'In production', '2026-08-23', undefined],
  ['MTO-013', 'Axens', '4500080288', 'Received', undefined, '2026-08-11'],
  ['MTO-014', 'Siemens Energy', '4500079423', 'Shipped', '2026-08-21', undefined],
  ['MTO-015', 'Oman Refractories', '4500080301', 'Received', undefined, '2026-08-08'],
  ['MTO-016', 'Sohar Steel Fabrication', '4500080355', 'Received', undefined, '2026-08-10'],
  ['MTO-017', 'Gulf Insulation Co', '4500080102', 'Received', undefined, '2026-08-07'],
  ['MTO-018', 'Emerson Process', '4500079188', 'In production', '2026-08-20', undefined],
  ['MTO-019', 'ABB Oman', undefined, 'PR raised', undefined, undefined],
  ['MTO-020', 'Sohar Steel Fabrication', '4500080356', 'Received', undefined, '2026-08-13'],
  ['MTO-021', 'ABB Oman', '4500080210', 'Received', undefined, '2026-08-12'],
  ['MTO-022', 'John Crane', '4500080188', 'Received', undefined, '2026-08-12'],
  ['MTO-023', 'Al Hadid Fasteners', '4500080402', 'Received', undefined, '2026-08-06'],
  ['MTO-024', 'Special Metals', undefined, 'Not requested', undefined, undefined],
  ['MTO-025', 'John Zink Hamworthy', undefined, 'Not requested', undefined, undefined],
  ['MTO-026', 'Oman Grating Co', undefined, 'Not requested', undefined, undefined],
];

export const procLines: ProcLine[] = rows.map((r) => ({ id: r[0], vendor: r[1], po: r[2], ship: r[3], eta: r[4], receivedOn: r[5], expedited: false }));
