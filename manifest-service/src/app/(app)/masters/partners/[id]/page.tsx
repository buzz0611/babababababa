import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { deleteContract, deleteEmitterSite, saveContract, saveEmitterSite, savePartner } from '@/actions/masters';
import { ConfirmButton } from '@/components/ConfirmButton';
import { D, Flash, type SP } from '@/components/ui';
import { db, schema } from '@/db';
import { PartnerFields } from '../PartnerFields';

export default async function PartnerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [p] = await db.select().from(schema.partners).where(eq(schema.partners.id, Number(id) || 0));
  if (!p) notFound();
  const [sites, contracts] = await Promise.all([
    db.select().from(schema.emitterSites).where(eq(schema.emitterSites.partnerId, p.id)),
    db.select().from(schema.contracts).where(eq(schema.contracts.partnerId, p.id)),
  ]);
  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>{p.name}</h1>
          <span className="spacer" />
          <Link className="btn" href="/masters/partners">← 取引先一覧</Link>
        </div>
        <form action={savePartner}>
          <input type="hidden" name="id" value={p.id} />
          <PartnerFields p={p} />
          <div style={{ marginTop: 10 }}><button className="btn primary">保存</button></div>
        </form>
      </div>

      {p.isEmitter && (
        <div className="card">
          <h2>排出事業場</h2>
          {sites.length > 0 && (
            <table>
              <thead><tr><th>名称</th><th>所在地</th><th /></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td><td>{s.address}</td>
                    <td>
                      <form action={deleteEmitterSite}>
                        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="partnerId" value={p.id} />
                        <ConfirmButton className="btn small danger" message="削除しますか？">削除</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form action={saveEmitterSite} className="row" style={{ marginTop: 10 }}>
            <input type="hidden" name="partnerId" value={p.id} />
            <input name="name" placeholder="事業場名" required style={{ maxWidth: 220 }} />
            <input name="address" placeholder="所在地" style={{ maxWidth: 360 }} />
            <button className="btn">追加</button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>委託契約</h2>
        {contracts.length > 0 && (
          <table>
            <thead><tr><th>契約名</th><th>方向</th><th>品目</th><th>期間</th><th>備考</th><th /></tr></thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td><td>{c.direction === 'inbound' ? '受託' : '委託'}</td><td>{c.wasteTypes}</td>
                  <td className="nowrap"><D d={c.startDate} /> 〜 <D d={c.endDate} /></td><td>{c.note}</td>
                  <td>
                    <form action={deleteContract}>
                      <input type="hidden" name="id" value={c.id} /><input type="hidden" name="partnerId" value={p.id} />
                      <ConfirmButton className="btn small danger" message="削除しますか？">削除</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={saveContract} style={{ marginTop: 10 }}>
          <input type="hidden" name="partnerId" value={p.id} />
          <div className="form">
            <label><span className="req">契約名</span><input name="title" required /></label>
            <label>方向<select name="direction" defaultValue={p.isDisposer && !p.isEmitter ? 'outbound' : 'inbound'}><option value="inbound">受託（排出事業者から）</option><option value="outbound">委託（二次委託先へ）</option></select></label>
            <label>品目<input name="wasteTypes" placeholder="汚泥,廃プラスチック類" /></label>
            <label>開始日<input type="date" name="startDate" /></label>
            <label>終了日<input type="date" name="endDate" /></label>
            <label>備考<input name="note" /></label>
          </div>
          <div style={{ marginTop: 10 }}><button className="btn">契約を追加</button></div>
        </form>
      </div>
    </>
  );
}
