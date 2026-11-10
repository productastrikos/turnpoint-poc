import type { Baseline, Certificate } from '../../services/scopeService';
import { FREEZE_DATE } from '../../mocks/scopeMock';
import { longDate, longStamp } from '../../mocks/_gen';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Self-contained, printable HTML of one certificate revision (the "Download" button). */
export function certificateHtml(cert: Certificate, baseline: Baseline | undefined, latest: boolean): string {
  const sigs = cert.signatures
    .map((s) => `<div class="sig"><div class="name">${esc(s.name)}</div><div class="role">${esc(s.role)}</div><div class="meta">${esc(longStamp(s.at))}${s.carried ? ' (carried from Rev A)' : ''}</div><div class="meta">sig ${s.hash} - verified</div></div>`)
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(cert.number)} Rev ${cert.revision}</title><style>
body{font-family:Segoe UI,Arial,sans-serif;color:#17202a;max-width:860px;margin:32px auto;padding:0 24px}
h1{font-size:26px;margin:4px 0}.eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5b6773}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #d6dbe0;padding-bottom:14px;margin-bottom:16px}
.status{display:inline-block;padding:2px 10px;border-radius:999px;background:${latest ? '#dff3e6' : '#eceff2'};color:${latest ? '#14683a' : '#5b6773'};font-weight:700;font-size:12px}
table{border-collapse:collapse;width:100%;margin:14px 0}td,th{border:1px solid #d6dbe0;padding:8px 10px;text-align:left;font-size:13px}th{background:#f4f6f8}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.sig{border:1px solid #d6dbe0;border-left:3px solid #1a8f4c;padding:8px 10px}
.name{font-family:cursive;font-size:18px;color:#1b4f8a}.role{font-weight:600;font-size:12px}.meta{font-size:11px;color:#5b6773;font-family:Consolas,monospace}
.foot{margin-top:22px;border-top:1px solid #d6dbe0;padding-top:10px;font-size:11px;color:#5b6773}
</style></head><body>
<div class="head"><div><div class="eyebrow">OQ Refineries &amp; Petrochemical Industries - Sohar Refinery</div><h1>Turnaround Scope Freeze Certificate</h1>
<div>Major STO 2026 - Certificate ${esc(cert.number)} - Revision ${cert.revision}</div></div>
<div style="text-align:right"><span class="status">${latest ? 'CURRENT' : 'SUPERSEDED'}</span><div class="meta">Freeze date ${esc(longDate(baseline?.frozenAt ?? FREEZE_DATE))}</div><div class="meta">Issued ${esc(longStamp(cert.issuedAt))}</div></div></div>
<p>This certifies that the scope of work for the Major Shutdown / Turnaround 2026 passed the three-stage gating process and is frozen as the approved baseline. Any later addition, deletion or change is a variation and needs formal approval. This revision: ${esc(cert.reason)}.</p>
<table><tr><th>Scope items (POC subset)</th><th>Man-hours</th><th>Item cost (OMR)</th><th>Programme estimate (OMR)</th></tr>
<tr><td>${cert.items}</td><td>${cert.manhours.toLocaleString()}</td><td>${cert.costOMR.toLocaleString()}</td><td>${cert.estimateOMR.toLocaleString()}</td></tr></table>
${cert.revision === 'A' ? '' : `<p>Against the Rev A baseline: ${cert.diff.added} added, ${cert.diff.removed} removed, ${cert.diff.changed} changed; net ${cert.diff.costOMR >= 0 ? '+' : '-'}OMR ${Math.abs(cert.diff.costOMR).toLocaleString()} and ${cert.diff.manhours >= 0 ? '+' : '-'}${Math.abs(cert.diff.manhours).toLocaleString()} man-hours. Variations: ${esc(cert.variationIds.join(', ') || 'none')}.</p>`}
<div class="eyebrow">Digital signatures</div><div class="sigs">${sigs}</div>
<div class="foot">Digitally signed (simulated). Certificate hash ${cert.hash}. Valid until superseded by a later revision.</div>
</body></html>`;
}

export function downloadCertificate(cert: Certificate, baseline: Baseline | undefined, latest: boolean) {
  const blob = new Blob([certificateHtml(cert, baseline, latest)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cert.number}_Rev${cert.revision}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
