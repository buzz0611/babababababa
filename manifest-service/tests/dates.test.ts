import { describe, expect, it } from 'vitest';
import { addBusinessDays, fiscalRange, fiscalYear, isNonBusinessDay, monthRange } from '@/lib/domain/dates';

describe('営業日計算（電子マニフェストの3日以内）', () => {
  it('平日起点は3営業日後', () => {
    expect(addBusinessDays('2026-10-13', 3)).toBe('2026-10-16'); // 火→金
  });
  it('土日をまたぐ', () => {
    expect(addBusinessDays('2026-10-16', 3)).toBe('2026-10-21'); // 金→水
  });
  it('祝日を除く（2026-11-03 文化の日）', () => {
    expect(isNonBusinessDay('2026-11-03')).toBe(true);
    expect(addBusinessDays('2026-11-02', 3)).toBe('2026-11-06');
  });
  it('年末年始 12/29〜1/3 を除く', () => {
    expect(isNonBusinessDay('2026-12-29')).toBe(true);
    expect(isNonBusinessDay('2027-01-03')).toBe(true);
    expect(addBusinessDays('2026-12-28', 3)).toBe('2027-01-06'); // 1/4月,1/5火,1/6水
  });
});

describe('年度', () => {
  it('4月始まり', () => {
    expect(fiscalYear('2026-03-31')).toBe(2025);
    expect(fiscalYear('2026-04-01')).toBe(2026);
    expect(fiscalRange(2026)).toEqual({ from: '2026-04-01', to: '2027-03-31' });
  });
  it('1月始まり', () => {
    expect(fiscalYear('2026-12-31', 1)).toBe(2026);
    expect(fiscalRange(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
  it('月の範囲', () => {
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
