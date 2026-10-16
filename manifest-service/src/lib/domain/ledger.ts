import { round3 } from './constants';
import type { DateStr } from './dates';

/**
 * 処分業者の帳簿（廃棄物処理法施行規則 第10条の8 処分の項）。
 * 記載事項：受入れ又は処分年月日 / 交付された管理票ごとの管理票交付者の氏名又は名称・交付年月日・交付番号 /
 *           受入先ごとの受入量 / 処分方法ごとの処分量 / 処分（埋立処分を除く）後の廃棄物の持出先ごとの持出量
 */

export interface LedgerManifest {
  id: number;
  manifestNo: string;
  issueDate: DateStr;
  emitterName: string;
  wasteType: string;
  receivedDate: DateStr | null;
  receivedQtyT: number | null;
  disposalMethod: string;
  disposalEndDate: DateStr | null;
  disposedQtyT: number | null;
}

export interface LedgerSecondary {
  id: number;
  manifestNo: string;
  issueDate: DateStr;
  wasteType: string;
  qtyT: number;
  disposerName: string;
  destAddress: string;
}

export type LedgerEntryKind = '受入' | '処分' | '持出';

export interface LedgerEntry {
  date: DateStr;
  kind: LedgerEntryKind;
  manifestNo: string;
  issueDate: DateStr;
  /** 管理票交付者（持出は自社が交付者なので委託先名を入れる） */
  party: string;
  wasteType: string;
  method: string;
  qtyT: number | null;
}

export interface LedgerSummaryRow { key: string; wasteType: string; qtyT: number; count: number }

export interface Ledger {
  entries: LedgerEntry[];
  byEmitter: LedgerSummaryRow[];
  byMethod: LedgerSummaryRow[];
  byDestination: LedgerSummaryRow[];
  totals: { receivedT: number; disposedT: number; shippedT: number };
  /** 受入済みだが受入量未計量など、帳簿に記載できない不備 */
  issues: string[];
}

const inRange = (d: DateStr | null, from: DateStr, to: DateStr): d is DateStr => !!d && d >= from && d <= to;

function summarize(rows: { key: string; wasteType: string; qty: number | null }[]): LedgerSummaryRow[] {
  const map = new Map<string, LedgerSummaryRow>();
  for (const r of rows) {
    const k = `${r.key}\u0000${r.wasteType}`;
    const cur = map.get(k) ?? { key: r.key, wasteType: r.wasteType, qtyT: 0, count: 0 };
    cur.qtyT = round3(cur.qtyT + (r.qty ?? 0));
    cur.count++;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key, 'ja') || a.wasteType.localeCompare(b.wasteType, 'ja'));
}

export function buildLedger(manifests: LedgerManifest[], secondaries: LedgerSecondary[], from: DateStr, to: DateStr): Ledger {
  const entries: LedgerEntry[] = [];
  const issues: string[] = [];
  const received = manifests.filter((m) => inRange(m.receivedDate, from, to));
  const disposed = manifests.filter((m) => inRange(m.disposalEndDate, from, to));
  const shipped = secondaries.filter((s) => inRange(s.issueDate, from, to));

  for (const m of received) {
    entries.push({ date: m.receivedDate!, kind: '受入', manifestNo: m.manifestNo, issueDate: m.issueDate, party: m.emitterName, wasteType: m.wasteType, method: '', qtyT: m.receivedQtyT });
    if (m.receivedQtyT == null) issues.push(`交付番号 ${m.manifestNo}：受入量が未入力です`);
  }
  for (const m of disposed) {
    entries.push({ date: m.disposalEndDate!, kind: '処分', manifestNo: m.manifestNo, issueDate: m.issueDate, party: m.emitterName, wasteType: m.wasteType, method: m.disposalMethod, qtyT: m.disposedQtyT });
    if (m.disposedQtyT == null) issues.push(`交付番号 ${m.manifestNo}：処分量が未入力です`);
    if (!m.disposalMethod) issues.push(`交付番号 ${m.manifestNo}：処分方法が未入力です`);
  }
  for (const s of shipped) {
    entries.push({ date: s.issueDate, kind: '持出', manifestNo: s.manifestNo, issueDate: s.issueDate, party: s.disposerName, wasteType: s.wasteType, method: s.destAddress, qtyT: s.qtyT });
  }
  const order: Record<LedgerEntryKind, number> = { 受入: 0, 処分: 1, 持出: 2 };
  entries.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.manifestNo.localeCompare(b.manifestNo));

  const sum = (xs: (number | null)[]) => round3(xs.reduce<number>((a, b) => a + (b ?? 0), 0));
  return {
    entries,
    byEmitter: summarize(received.map((m) => ({ key: m.emitterName, wasteType: m.wasteType, qty: m.receivedQtyT }))),
    byMethod: summarize(disposed.map((m) => ({ key: m.disposalMethod || '（未入力）', wasteType: m.wasteType, qty: m.disposedQtyT }))),
    byDestination: summarize(shipped.map((s) => ({ key: `${s.disposerName}${s.destAddress ? `（${s.destAddress}）` : ''}`, wasteType: s.wasteType, qty: s.qtyT }))),
    totals: {
      receivedT: sum(received.map((m) => m.receivedQtyT)),
      disposedT: sum(disposed.map((m) => m.disposedQtyT)),
      shippedT: sum(shipped.map((s) => s.qtyT)),
    },
    issues,
  };
}

/** 帳簿の記載期限（翌月末） */
export function ledgerEntryDeadline(date: DateStr): DateStr {
  const [y, m] = date.split('-').map(Number);
  // 月を1つ進めた月の「0日」＝翌月末
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
}
