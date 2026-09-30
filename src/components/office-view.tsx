'use client';

import { useEffect, useState } from 'react';

/**
 * In-app viewers for Office documents whose bytes we already hold decrypted.
 * Encrypted attachments have no public URL, so the Microsoft/Google online
 * viewers can't reach them — instead we parse the bytes client-side and render
 * them. Libraries are lazy-loaded (dynamic import) so they never touch the main
 * bundle; they load only when someone actually opens such a file.
 *
 * Supported inline: spreadsheets (.xlsx via exceljs, .csv parsed directly) and
 * Word (.docx via mammoth). PowerPoint has no reliable in-browser renderer, so
 * it still falls back to download.
 */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** Renders a spreadsheet (xlsx/csv) as scrollable tables, one tab per sheet. */
export function SpreadsheetView({ blob, csv }: { blob: Blob; csv?: boolean }) {
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[] | null>(null);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (csv) {
          const text = await blob.text();
          if (!cancelled) setSheets([{ name: 'CSV', rows: parseCsv(text) }]);
          return;
        }
        const mod = await import('exceljs');
        const ExcelJS = (mod as unknown as { default?: unknown }).default ?? mod;
        const wb = new (ExcelJS as { Workbook: new () => any }).Workbook();
        const buf = await blob.arrayBuffer();
        await wb.xlsx.load(buf);
        const out: { name: string; rows: string[][] }[] = [];
        wb.eachSheet((ws: any) => {
          const rows: string[][] = [];
          ws.eachRow({ includeEmpty: false }, (row: any) => {
            const cells: string[] = [];
            const count = Math.max(ws.columnCount || 0, row.cellCount || 0);
            for (let c = 1; c <= count; c++) {
              const cell = row.getCell(c);
              cells.push(cell?.text != null ? String(cell.text) : '');
            }
            rows.push(cells);
          });
          out.push({ name: ws.name || `Sheet ${out.length + 1}`, rows });
        });
        if (!cancelled) setSheets(out.length ? out : [{ name: 'Sheet', rows: [] }]);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => { cancelled = true; };
  }, [blob, csv]);

  if (err) return <p className="text-sm text-red-300">No se pudo abrir la hoja de cálculo.</p>;
  if (!sheets) return <div className="h-40 w-full max-w-2xl animate-pulse rounded-2xl bg-white/10" />;

  const sheet = sheets[active] ?? sheets[0];
  return (
    <div className="flex h-full w-full flex-col">
      {sheets.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {sheets.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === active ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-white/10 bg-white">
        <table className="border-collapse text-xs text-slate-900">
          <tbody>
            {sheet.rows.map((r, ri) => (
              <tr key={ri} className={ri === 0 ? 'bg-slate-100 font-semibold' : ri % 2 ? 'bg-slate-50' : ''}>
                {r.map((cell, ci) => (
                  <td key={ci} className="whitespace-pre border border-slate-200 px-2 py-1 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.rows.length === 0 && <p className="p-4 text-sm text-slate-500">Hoja vacía.</p>}
      </div>
    </div>
  );
}

/** Renders a Word document (.docx) as formatted HTML via mammoth. */
export function DocxView({ blob }: { blob: Blob }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The browser build avoids Node-only deps (fs, etc.).
        const mammoth = await import('mammoth/mammoth.browser');
        const buf = await blob.arrayBuffer();
        const res = await (mammoth as unknown as {
          convertToHtml: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        }).convertToHtml({ arrayBuffer: buf });
        if (!cancelled) setHtml(res.value || '<p>(Documento vacío)</p>');
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => { cancelled = true; };
  }, [blob]);

  if (err) return <p className="text-sm text-red-300">No se pudo abrir el documento.</p>;
  if (html == null) return <div className="h-40 w-full max-w-2xl animate-pulse rounded-2xl bg-white/10" />;

  return (
    <div className="max-h-full w-full max-w-2xl overflow-auto rounded-lg bg-white p-6">
      <div
        className="toky-docx text-sm leading-relaxed text-slate-900 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_img]:my-2 [&_img]:max-w-full [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2 [&_table]:my-2 [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
