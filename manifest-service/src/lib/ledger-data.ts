import 'server-only';
import { getCompany, loadManifests, loadSecondaries } from './data';
import { fiscalRange, fiscalYear, monthRange, todayJst } from './domain/dates';
import { buildLedger } from './domain/ledger';

export interface LedgerQuery { facilityId: number; period: 'month' | 'year'; month: string; year: number }

export async function parseLedgerQuery(sp: Record<string, string | string[] | undefined>, defaultFacility: number): Promise<LedgerQuery> {
  const g = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v) ?? ''; };
  const { ledgerStartMonth } = await getCompany();
  const today = todayJst();
  return {
    facilityId: Number(g('facility')) || defaultFacility,
    period: g('period') === 'year' ? 'year' : 'month',
    month: /^\d{4}-\d{2}$/.test(g('month')) ? g('month') : today.slice(0, 7),
    year: Number(g('year')) || fiscalYear(today, ledgerStartMonth),
  };
}

export async function loadLedger(q: LedgerQuery) {
  const { ledgerStartMonth } = await getCompany();
  const range = q.period === 'year' ? fiscalRange(q.year, ledgerStartMonth) : monthRange(q.month);
  const [ms, ss] = await Promise.all([loadManifests({ facilityId: q.facilityId }), loadSecondaries({ facilityId: q.facilityId })]);
  const ledger = buildLedger(ms, ss, range.from, range.to);
  return { ledger, range, fiscalYearOfRange: fiscalYear(range.from, ledgerStartMonth) };
}
