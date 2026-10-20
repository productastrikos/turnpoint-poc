// Mock extraction results for the P&ID / isometric / GA analyzer (G8). Coordinates are in the drawing's own viewBox.
export type DrawingId = 'pid' | 'iso' | 'ga';

export interface Extracted {
  id: string;
  kind: 'Equipment' | 'Line' | 'Valve' | 'Instrument' | 'Fitting' | 'Support' | 'Dimension';
  tag: string;
  desc: string;
  spec: string;
  qty: number;
  uom: string;
  confidence: number;
  box: [number, number, number, number]; // x, y, w, h
  mto?: { description: string; leadWeeks: number; estCostOMR: number }; // pushed to the MTO when selected
}

export const DRAWINGS: Record<DrawingId, { label: string; ref: string; viewBox: string }> = {
  pid: { label: 'P&ID: CDU overhead system', ref: 'P&ID-U200-014 Rev C', viewBox: '0 0 900 430' },
  iso: { label: 'Isometric: line 14"-P-2201', ref: 'ISO-14-P-2201-S2 Rev B', viewBox: '0 0 900 430' },
  ga: { label: 'GA: exchanger E-204', ref: 'GA-E-204 Rev A', viewBox: '0 0 900 430' },
};

export const EXTRACTION: Record<DrawingId, Extracted[]> = {
  pid: [
    { id: 'p1', kind: 'Equipment', tag: 'T-201', desc: 'Atmospheric column', spec: 'ID 4,200 mm, 38 trays, 21 barg / 400 °C', qty: 1, uom: 'EA', confidence: 99, box: [60, 24, 110, 300] },
    { id: 'p2', kind: 'Equipment', tag: 'E-204', desc: 'Overhead condenser (floating head)', spec: 'Shell 1,200 mm, 480 tubes, 19.05 mm OD', qty: 1, uom: 'EA', confidence: 97, box: [300, 40, 120, 70] },
    { id: 'p3', kind: 'Equipment', tag: 'V-102', desc: 'Overhead receiver drum', spec: '2,000 x 6,000 mm TL, 10 barg', qty: 1, uom: 'EA', confidence: 98, box: [480, 120, 180, 80] },
    { id: 'p4', kind: 'Equipment', tag: 'P-205', desc: 'Reflux pump', spec: 'API 610 OH2, 85 m³/h, 7.5 bar', qty: 1, uom: 'EA', confidence: 96, box: [490, 300, 90, 70] },
    { id: 'p5', kind: 'Line', tag: '14"-P-2201', desc: 'Overhead vapour line', spec: '14", CS A106 Gr B, class 300, insulated', qty: 22, uom: 'M', confidence: 95, box: [170, 55, 130, 30], mto: { description: 'Pipe 14" CS A106 Gr B SCH 40, 22 m', leadWeeks: 9, estCostOMR: 4_600 } },
    { id: 'p6', kind: 'Line', tag: '8"-P-2204', desc: 'Condensate line', spec: '8", CS A106 Gr B, class 300', qty: 14, uom: 'M', confidence: 94, box: [420, 80, 70, 60], mto: { description: 'Pipe 8" CS A106 Gr B SCH 40, 14 m', leadWeeks: 7, estCostOMR: 1_700 } },
    { id: 'p7', kind: 'Valve', tag: 'PV-3021', desc: 'Reflux flow control valve', spec: '6", globe, class 300, CS body / 13Cr trim', qty: 1, uom: 'EA', confidence: 96, box: [300, 340, 70, 50], mto: { description: 'Control valve 6" globe class 300 (PV-3021)', leadWeeks: 20, estCostOMR: 5_800 } },
    { id: 'p8', kind: 'Valve', tag: 'XV-2210', desc: 'Isolation valve, receiver outlet', spec: '8", gate, class 300', qty: 1, uom: 'EA', confidence: 93, box: [585, 215, 60, 45], mto: { description: 'Gate valve 8" class 300 (XV-2210)', leadWeeks: 14, estCostOMR: 2_400 } },
    { id: 'p9', kind: 'Valve', tag: 'RV-1104', desc: 'Pressure safety valve on V-102', spec: '4" x 6" Q, set 9 barg', qty: 1, uom: 'EA', confidence: 95, box: [560, 60, 60, 50], mto: { description: 'PSV 4Qx6 set 9 barg (RV-1104)', leadWeeks: 16, estCostOMR: 6_400 } },
    { id: 'p10', kind: 'Instrument', tag: 'FT-2210', desc: 'Reflux flow transmitter', spec: 'DP type, 4-20 mA HART', qty: 1, uom: 'EA', confidence: 92, box: [200, 330, 55, 55], mto: { description: 'Flow transmitter DP type (FT-2210)', leadWeeks: 6, estCostOMR: 1_800 } },
    { id: 'p11', kind: 'Instrument', tag: 'LT-4012', desc: 'Receiver level transmitter', spec: 'Guided wave radar', qty: 1, uom: 'EA', confidence: 91, box: [680, 140, 55, 55], mto: { description: 'Level transmitter GWR (LT-4012)', leadWeeks: 6, estCostOMR: 2_200 } },
    { id: 'p12', kind: 'Fitting', tag: 'FL-14-300', desc: 'Flanges 14" WN RF class 300', spec: 'ASTM A105', qty: 6, uom: 'EA', confidence: 90, box: [255, 60, 38, 22], mto: { description: 'Flange 14" WN RF 300# A105 (6 off)', leadWeeks: 8, estCostOMR: 2_100 } },
  ],
  iso: [
    { id: 'i1', kind: 'Line', tag: '14"-P-2201', desc: 'Straight pipe run', spec: '14", CS A106 Gr B SCH 40', qty: 18.6, uom: 'M', confidence: 98, box: [80, 160, 640, 120], mto: { description: 'Pipe 14" CS A106 Gr B SCH 40, 18.6 m', leadWeeks: 9, estCostOMR: 3_900 } },
    { id: 'i2', kind: 'Fitting', tag: 'EL-90-LR', desc: '90° long radius elbow', spec: '14" BW SCH 40', qty: 4, uom: 'EA', confidence: 97, box: [200, 100, 60, 60], mto: { description: 'Elbow 90° LR 14" BW SCH 40 (4 off)', leadWeeks: 6, estCostOMR: 1_200 } },
    { id: 'i3', kind: 'Fitting', tag: 'FL-WN', desc: 'Weld-neck flange 14" 300# RF', spec: 'ASTM A105', qty: 6, uom: 'EA', confidence: 96, box: [110, 280, 50, 60], mto: { description: 'Flange 14" WN RF 300# A105 (6 off)', leadWeeks: 8, estCostOMR: 2_100 } },
    { id: 'i4', kind: 'Fitting', tag: 'GSK-SW', desc: 'Spiral wound gasket 14" 300#', spec: '316L / graphite', qty: 3, uom: 'EA', confidence: 94, box: [330, 290, 50, 50], mto: { description: 'Spiral wound gasket 14" 300# (3 off)', leadWeeks: 3, estCostOMR: 420 } },
    { id: 'i5', kind: 'Valve', tag: 'GV-2201', desc: 'Gate valve 14" class 300', spec: 'CS body, 13Cr trim, flanged', qty: 1, uom: 'EA', confidence: 95, box: [450, 180, 80, 80], mto: { description: 'Gate valve 14" class 300 (GV-2201)', leadWeeks: 22, estCostOMR: 7_900 } },
    { id: 'i6', kind: 'Support', tag: 'PS-S2', desc: 'Pipe shoe supports', spec: 'Shoe type, CS galvanised', qty: 5, uom: 'EA', confidence: 91, box: [560, 300, 140, 50], mto: { description: 'Pipe shoe support 14" (5 off)', leadWeeks: 5, estCostOMR: 1_100 } },
    { id: 'i7', kind: 'Dimension', tag: 'WELDS', desc: 'Butt welds, 14" (inch-diameter 196)', spec: 'WPS-CS-04, 100% RT', qty: 14, uom: 'EA', confidence: 93, box: [150, 130, 520, 40] },
  ],
  ga: [
    { id: 'g1', kind: 'Equipment', tag: 'E-204', desc: 'Floating head heat exchanger (AES)', spec: 'Shell ID 1,200 mm, tube length 6,096 mm', qty: 1, uom: 'EA', confidence: 99, box: [90, 120, 640, 160] },
    { id: 'g2', kind: 'Dimension', tag: 'TUBES', desc: 'Tube bundle', spec: '480 tubes, 19.05 mm OD, 2.1 mm wall, A179', qty: 480, uom: 'EA', confidence: 94, box: [180, 150, 380, 100], mto: { description: 'Tube bundle 480 x 19.05 mm A179 (E-204)', leadWeeks: 19, estCostOMR: 118_000 } },
    { id: 'g3', kind: 'Fitting', tag: 'N1-N4', desc: 'Nozzles 12" / 8" class 300', spec: 'N1, N2 12"; N3, N4 8"', qty: 4, uom: 'EA', confidence: 95, box: [180, 60, 340, 60] },
    { id: 'g4', kind: 'Support', tag: 'SDL', desc: 'Saddle supports', spec: 'Fixed and sliding, 2 off', qty: 2, uom: 'EA', confidence: 92, box: [240, 280, 300, 50] },
    { id: 'g5', kind: 'Dimension', tag: 'DESIGN', desc: 'Design data', spec: '21 barg / 250 °C shell, 28 barg / 280 °C tube, 18,400 kg empty', qty: 1, uom: 'LOT', confidence: 97, box: [90, 350, 360, 50] },
    { id: 'g6', kind: 'Fitting', tag: 'GSK-FH', desc: 'Floating head gasket set', spec: 'Spiral wound 316L', qty: 1, uom: 'SET', confidence: 90, box: [640, 130, 70, 140], mto: { description: 'Gasket set floating head, E-204', leadWeeks: 4, estCostOMR: 1_900 } },
  ],
};
