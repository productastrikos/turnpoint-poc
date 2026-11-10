import { useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { useToast } from '../../app/ToastContext';
import type { HandoverDoc } from '../../mocks/closeoutMock';
import { longDate } from '../../mocks/_gen';

// PBC 03 item 12: at close-out the bidder gives OQ every document, stored in OQ's shared folders in an openly
// acceptable format, and a confirmation letter. This card generates that letter from the live handover list.

const FORMATS = [
  ['Drawings and models', 'PDF, plus DWG / IFC where native'],
  ['Registers, logs and reports', 'XLSX and CSV'],
  ['Certificates and records', 'PDF/A'],
  ['Photos and inspection evidence', 'JPG / PNG, with a CSV index'],
] as const;

const LETTER_DATE = '2026-09-10';

function letterHtml(rows: HandoverDoc[], ref: string): string {
  const total = rows.reduce((s, r) => s + r.expected, 0);
  const got = rows.reduce((s, r) => s + r.received, 0);
  const archived = rows.filter((r) => r.status === 'Archived').length;
  const fmt = FORMATS.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${ref}</title><style>
body{font-family:Segoe UI,Arial,sans-serif;color:#17202a;max-width:760px;margin:36px auto;padding:0 24px;line-height:1.55;font-size:14px}
h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #d6dbe0;padding:7px 10px;text-align:left;font-size:13px}th{background:#f4f6f8}
.meta{color:#5b6773;font-size:12px}</style></head><body>
<div class="meta">Ref ${ref} - ${longDate(LETTER_DATE)}</div>
<p>To: OQ Refineries &amp; Petrochemical Industries, Sohar Refinery - Turnaround Office<br>From: Spectrum, with Siemens and Astrikos</p>
<h1>Confirmation of end-to-end document handover and archiving, Major STO 2026</h1>
<p>We confirm that, as part of the turnaround close-out, we will provide all project and turnaround documents to OQ, to be stored in OQ's shared folders, in the formats below. The documents are listed per discipline and asset in the OQ handover register (${rows.length} document sets, ${got} of ${total} documents received, ${archived} sets archived at the date of this letter).</p>
<table><tr><th>Content</th><th>Open format</th></tr>${fmt}</table>
<p>Archive location: /Archive/STO-2026/ in OQ's shared folders, one folder per discipline. The handover is complete only when every document set shows as Archived in the register.</p>
<p>Signed for the bidder: ____________________ &nbsp;&nbsp; Date: ____________</p>
<p class="meta">Generated from the OQ platform (simulated signature for this demo).</p></body></html>`;
}

export function ConfirmationLetterCard({ rows }: { rows: HandoverDoc[] }) {
  const { showToast } = useToast();
  const [ref, setRef] = useState<string | null>(null);

  function generate() {
    const r = `HO-CONF-2026-${String(rows.length).padStart(3, '0')}`;
    setRef(r);
    showToast(`Confirmation letter ${r} generated from ${rows.length} document sets. Download it or print it.`, 'good');
  }
  function download() {
    if (!ref) return;
    const url = URL.createObjectURL(new Blob([letterHtml(rows, ref)], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ref}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`${ref} downloaded.`, 'accent');
  }

  const total = rows.reduce((s, r) => s + r.expected, 0);
  const got = rows.reduce((s, r) => s + r.received, 0);

  return (
    <Card>
      <CardHeader
        title="Handover confirmation letter (PBC item 12)"
        action={
          <span className="row" style={{ gap: 8 }}>
            {ref && <button className="btn btn-sm" onClick={download}>Download letter</button>}
            <button className="btn btn-sm btn-primary" onClick={generate}>{ref ? 'Regenerate' : 'Generate confirmation letter'}</button>
          </span>
        }
      />
      {!ref ? (
        <p className="small muted" style={{ margin: 0 }}>At close-out the bidder gives OQ all documents, stored in OQ shared folders in an open format, with a signed confirmation letter. Generate it from the register below.</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8 }}><Chip tone="good">{ref}</Chip><span className="small muted">{longDate(LETTER_DATE)}</span></div>
          <p style={{ margin: 0 }}>
            We confirm that all turnaround documents will be handed to OQ and stored in OQ's shared folders under <span className="mono">/Archive/STO-2026/</span>, in the open formats below.
            Register status today: {rows.length} document sets, {got} of {total} documents received.
          </p>
          <div className="row-wrap" style={{ gap: 8 }}>{FORMATS.map(([k, v]) => <Chip key={k} tone="neutral">{k}: {v}</Chip>)}</div>
        </div>
      )}
    </Card>
  );
}
