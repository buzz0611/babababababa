import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { currentUser } from '@/lib/auth';
import { toCsv } from '@/lib/jwnet/csv';
import { loadLedger, parseLedgerQuery } from '@/lib/ledger-data';

export async function GET(req: Request) {
  if (!(await currentUser())) return new Response('Unauthorized', { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const q = await parseLedgerQuery(sp, 0);
  const [facility] = await db.select().from(schema.facilities).where(eq(schema.facilities.id, q.facilityId));
  if (!facility) return new Response('Not found', { status: 404 });
  const { ledger, range } = await loadLedger(q);
  const rows = [
    ['処分業者帳簿', facility.name, `${range.from}〜${range.to}`],
    [],
    ['年月日', '区分', '管理票交付者／委託先', '交付年月日', '交付番号', '廃棄物の種類', '処分方法／持出先', '数量(t)'],
    ...ledger.entries.map((e) => [e.date, e.kind, e.party, e.issueDate, e.manifestNo, e.wasteType, e.method, e.qtyT]),
    [],
    ['受入先ごとの受入量'], ['受入先', '種類', '件数', '数量(t)'], ...ledger.byEmitter.map((r) => [r.key, r.wasteType, r.count, r.qtyT]),
    [],
    ['処分方法ごとの処分量'], ['処分方法', '種類', '件数', '数量(t)'], ...ledger.byMethod.map((r) => [r.key, r.wasteType, r.count, r.qtyT]),
    [],
    ['持出先ごとの持出量'], ['持出先', '種類', '件数', '数量(t)'], ...ledger.byDestination.map((r) => [r.key, r.wasteType, r.count, r.qtyT]),
  ];
  const name = `帳簿_${facility.name}_${range.from}_${range.to}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
