import Link from 'next/link';
import { savePartner } from '@/actions/masters';
import { D, Flash, one, type SP } from '@/components/ui';
import { listPartners } from '@/lib/data';
import { PartnerFields } from './PartnerFields';

export default async function Partners({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const role = one(sp.role) as 'emitter' | 'transporter' | 'disposer' | '';
  const list = await listPartners(role || undefined);
  const roles = (p: (typeof list)[number]) => [p.isEmitter && '排出', p.isTransporter && '運搬', p.isDisposer && '処分'].filter(Boolean).join('・');
  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>取引先</h1>
          <span className="spacer" />
          <Link className="btn" href="/masters">← マスタ</Link>
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          {[['', 'すべて'], ['emitter', '排出事業者'], ['transporter', '収集運搬'], ['disposer', '処分（二次委託先）']].map(([k, l]) => (
            <Link key={k} className={`btn small ${role === k ? 'primary' : ''}`} href={k ? `/masters/partners?role=${k}` : '/masters/partners'}>{l}</Link>
          ))}
        </div>
        {list.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>名称</th><th>区分</th><th>住所</th><th>許可番号</th><th>許可期限</th><th>JWNET</th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/masters/partners/${p.id}`}>{p.name}</Link>{!p.active && <span className="tag">取引停止</span>}</td>
                    <td>{roles(p)}</td><td>{p.address}</td><td>{p.permitNo}</td><td><D d={p.permitExpiry} /></td><td>{p.jwnetSubscriberNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">取引先が登録されていません</div>}
      </div>
      <div className="card">
        <h2>取引先を追加</h2>
        <form action={savePartner}>
          <PartnerFields />
          <div style={{ marginTop: 10 }}><button className="btn primary">追加</button></div>
        </form>
      </div>
    </>
  );
}
