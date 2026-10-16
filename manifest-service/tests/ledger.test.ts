import { describe, expect, it } from 'vitest';
import { buildLedger, ledgerEntryDeadline, type LedgerManifest } from '@/lib/domain/ledger';

const m = (o: Partial<LedgerManifest>): LedgerManifest => ({
  id: 1, manifestNo: 'A1', issueDate: '2026-04-01', emitterName: 'A社', wasteType: '汚泥',
  receivedDate: null, receivedQtyT: null, disposalMethod: '', disposalEndDate: null, disposedQtyT: null, ...o,
});

describe('帳簿', () => {
  const ms = [
    m({ id: 1, manifestNo: 'A1', receivedDate: '2026-04-02', receivedQtyT: 1.5, disposalMethod: '脱水', disposalEndDate: '2026-04-05', disposedQtyT: 1.5 }),
    m({ id: 2, manifestNo: 'A2', receivedDate: '2026-04-10', receivedQtyT: 2.25, disposalMethod: '脱水', disposalEndDate: '2026-05-02', disposedQtyT: 2.25 }),
    m({ id: 3, manifestNo: 'B1', emitterName: 'B社', wasteType: '廃プラスチック類', receivedDate: '2026-04-20' }),
    m({ id: 4, manifestNo: 'X', receivedDate: '2026-03-31', receivedQtyT: 9 }),
  ];
  const ss = [{ id: 1, manifestNo: 'S1', issueDate: '2026-04-25', wasteType: '汚泥', qtyT: 0.8, disposerName: '最終処分C社', destAddress: '栃木県' }];
  const l = buildLedger(ms, ss, '2026-04-01', '2026-04-30');

  it('期間内の受入・処分・持出を日付順に並べる', () => {
    expect(l.entries.map((e) => `${e.date} ${e.kind} ${e.manifestNo}`)).toEqual([
      '2026-04-02 受入 A1', '2026-04-05 処分 A1', '2026-04-10 受入 A2', '2026-04-20 受入 B1', '2026-04-25 持出 S1',
    ]);
  });
  it('受入先ごと・処分方法ごと・持出先ごとに集計', () => {
    expect(l.byEmitter).toEqual([
      { key: 'A社', wasteType: '汚泥', qtyT: 3.75, count: 2 },
      { key: 'B社', wasteType: '廃プラスチック類', qtyT: 0, count: 1 },
    ]);
    expect(l.byMethod).toEqual([{ key: '脱水', wasteType: '汚泥', qtyT: 1.5, count: 1 }]);
    expect(l.byDestination[0]).toMatchObject({ key: '最終処分C社（栃木県）', qtyT: 0.8 });
    expect(l.totals).toEqual({ receivedT: 3.75, disposedT: 1.5, shippedT: 0.8 });
  });
  it('未入力の受入量を指摘', () => {
    expect(l.issues).toEqual(['交付番号 B1：受入量が未入力です']);
  });
  it('記載期限は翌月末', () => {
    expect(ledgerEntryDeadline('2026-04-15')).toBe('2026-05-31');
    expect(ledgerEntryDeadline('2026-12-01')).toBe('2027-01-31');
    expect(ledgerEntryDeadline('2028-01-31')).toBe('2028-02-29');
  });
});
