/** RFC 4180 形式のCSVを読む（BOM・引用符・改行入りセルに対応） */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export const toCsv = (rows: (string | number | null | undefined)[][]) =>
  '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

/** 取込CSVの列。見出しは別名でも受け付ける（JWNETからダウンロードしたCSVの見出しに合わせて追加可能） */
export const IMPORT_COLUMNS = {
  manifestNo: ['登録番号', 'マニフェスト番号', '交付番号'],
  issueDate: ['引渡し日', '引渡日', '交付年月日', '交付日'],
  emitterName: ['排出事業者名', '排出事業者', '排出事業者の氏名又は名称'],
  siteName: ['排出事業場名', '排出事業場の名称'],
  siteAddress: ['排出事業場住所', '排出事業場の所在地'],
  transporterName: ['収集運搬業者名', '収集運搬業者', '運搬受託者名'],
  wasteType: ['廃棄物の種類', '産業廃棄物の種類', '種類'],
  wasteName: ['廃棄物の名称', '名称'],
  qty: ['数量', '廃棄物の数量'],
  unit: ['単位', '数量の単位'],
  packaging: ['荷姿'],
} as const;

export type ImportRow = { -readonly [K in keyof typeof IMPORT_COLUMNS]: string };

export function readImportRows(text: string): { rows: ImportRow[]; errors: string[] } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { rows: [], errors: ['CSVが空です'] };
  const idx = {} as Record<keyof ImportRow, number>;
  const errors: string[] = [];
  for (const [key, names] of Object.entries(IMPORT_COLUMNS) as [keyof ImportRow, readonly string[]][]) {
    idx[key] = head.findIndex((h) => names.includes(h.trim()));
  }
  for (const k of ['manifestNo', 'issueDate', 'emitterName', 'wasteType'] as const) {
    if (idx[k] < 0) errors.push(`必須の列「${IMPORT_COLUMNS[k][0]}」が見つかりません`);
  }
  if (errors.length) return { rows: [], errors };
  const rows = body.map((r, i) => {
    const o = {} as ImportRow;
    for (const k of Object.keys(idx) as (keyof ImportRow)[]) o[k] = idx[k] >= 0 ? (r[idx[k]] ?? '').trim() : '';
    o.issueDate = o.issueDate.replace(/\//g, '-').replace(/-(\d)(?=-|$)/g, '-0$1');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.issueDate)) errors.push(`${i + 2}行目：日付「${o.issueDate}」を読めません`);
    o.manifestNo = o.manifestNo.replace(/[\s\-]/g, '');
    if (!o.manifestNo) errors.push(`${i + 2}行目：登録番号がありません`);
    else if (!/^\d+$/.test(o.manifestNo)) errors.push(`${i + 2}行目：登録番号「${o.manifestNo}」は数字ではありません`);
    return o;
  });
  return { rows, errors };
}
