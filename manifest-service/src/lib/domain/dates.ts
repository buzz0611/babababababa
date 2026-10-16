import holidayJp from '@holiday-jp/holiday_jp';

/** 日付はすべて 'YYYY-MM-DD' 文字列（ローカル日付）で扱う */
export type DateStr = string;

export const parse = (s: DateStr) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const fmt = (d: Date): DateStr => d.toISOString().slice(0, 10);
export const addDays = (s: DateStr, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};
export const diffDays = (from: DateStr, to: DateStr) => Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);

/** 日本時間の今日 */
export const todayJst = (): DateStr => fmt(new Date(Date.now() + 9 * 3600 * 1000));

/** 電子マニフェストの期限計算に含めない日（土日祝・年末年始 12/29〜1/3） */
export function isNonBusinessDay(s: DateStr): boolean {
  const d = parse(s);
  const wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return true;
  const md = s.slice(5);
  if (md >= '12-29' || md <= '01-03') return true;
  return holidayJp.isHoliday(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** 基準日の翌日から数えて n 営業日目（「3日以内」＝ addBusinessDays(基準日, 3)） */
export function addBusinessDays(s: DateStr, n: number): DateStr {
  let cur = s;
  let left = n;
  while (left > 0) {
    cur = addDays(cur, 1);
    if (!isNonBusinessDay(cur)) left--;
  }
  return cur;
}

/** 帳簿年度（startMonth 月始まり）。4月始まりなら 2026-03-31 → 2025 */
export function fiscalYear(s: DateStr, startMonth = 4): number {
  const [y, m] = s.split('-').map(Number);
  return m >= startMonth ? y : y - 1;
}
export function fiscalRange(year: number, startMonth = 4): { from: DateStr; to: DateStr } {
  const mm = String(startMonth).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: addDays(`${year + 1}-${mm}-01`, -1) };
}
export const monthRange = (ym: string): { from: DateStr; to: DateStr } => {
  const [y, m] = ym.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from: `${ym}-01`, to: addDays(next, -1) };
};

export const jp = (s: DateStr | null | undefined) => (s ? s.replace(/-/g, '/') : '');
