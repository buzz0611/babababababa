import { desc, eq } from 'drizzle-orm';
import { one, type SP } from '@/components/ui';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';

const ENTITY: Record<string, string> = {
  manifest: '受託マニフェスト', secondary_manifest: '二次マニフェスト', partner: '取引先', facility: '処分事業場', company: '自社情報',
  user: 'ユーザー', ledger: '帳簿', jwnet_message: 'JWNET', emitter_site: '排出事業場', contract: '委託契約',
};

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireAdmin();
  const entity = one(sp.entity);
  const rows = await db.select({ log: schema.auditLogs, userName: schema.users.name })
    .from(schema.auditLogs).leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.userId))
    .where(entity ? eq(schema.auditLogs.entity, entity) : undefined)
    .orderBy(desc(schema.auditLogs.id)).limit(300);
  return (
    <div className="card">
      <h1>操作履歴</h1>
      <form className="row" style={{ marginBottom: 10 }}>
        <select name="entity" defaultValue={entity} style={{ maxWidth: 220 }}>
          <option value="">すべて</option>
          {Object.entries(ENTITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn">絞り込み</button>
      </form>
      <div className="tablewrap">
        <table>
          <thead><tr><th>日時</th><th>ユーザー</th><th>操作</th><th>対象</th><th>内容</th></tr></thead>
          <tbody>
            {rows.map(({ log, userName }) => (
              <tr key={log.id}>
                <td className="nowrap">{log.at.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                <td>{userName ?? '—'}</td>
                <td>{log.action}</td>
                <td>{ENTITY[log.entity] ?? log.entity} {log.entityId && `#${log.entityId}`}</td>
                <td>
                  {(log.before != null || log.after != null) && (
                    <details><summary>詳細</summary><pre className="payload">{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre></details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">最新300件を表示しています。</p>
    </div>
  );
}
