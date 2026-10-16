import Link from 'next/link';
import { saveCompany, saveFacility } from '@/actions/masters';
import { D, Flash, one, type SP } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { getCompany, listFacilities } from '@/lib/data';

export default async function Masters({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [user, company, facilities] = await Promise.all([requireUser(), getCompany(), listFacilities()]);
  const admin = user.role === 'admin';
  const editId = Number(one(sp.facility));
  const editing = facilities.find((f) => f.id === editId);
  return (
    <>
      <Flash sp={sp} />
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>マスタ</h1>
        <span className="spacer" />
        <Link className="btn primary" href="/masters/partners">取引先（排出事業者・運搬・委託先）</Link>
      </div>
      {!admin && <p className="muted">自社情報・処分事業場の変更は管理者のみ行えます。</p>}
      <div className="card">
        <h2>自社情報（処分業者）</h2>
        <form action={saveCompany} className="form">
          <fieldset disabled={!admin} style={{ display: 'contents' }}>
            <label><span className="req">氏名又は名称</span><input name="name" defaultValue={company.name} required /></label>
            <label>住所<input name="address" defaultValue={company.address} /></label>
            <label>電話番号<input name="tel" defaultValue={company.tel} /></label>
            <label>代表者<input name="representative" defaultValue={company.representative} /></label>
            <label>JWNET加入者番号<input name="jwnetSubscriberNo" defaultValue={company.jwnetSubscriberNo} /></label>
            <label>帳簿の年度開始月<input type="number" min={1} max={12} name="ledgerStartMonth" defaultValue={company.ledgerStartMonth} /></label>
            <div><button className="btn primary">保存</button></div>
          </fieldset>
        </form>
      </div>
      <div className="card">
        <h2>処分事業場</h2>
        {facilities.length > 0 && (
          <div className="tablewrap">
            <table>
              <thead><tr><th>名称</th><th>所在地</th><th>許可番号</th><th>許可期限</th><th>処分方法</th><th>最終処分場</th><th /></tr></thead>
              <tbody>
                {facilities.map((f) => (
                  <tr key={f.id}>
                    <td>{f.name}{!f.active && <span className="tag">停止中</span>}</td><td>{f.address}</td>
                    <td>{f.permitNo}<div className="muted">{f.permitAuthority}</div></td><td><D d={f.permitExpiry} /></td>
                    <td>{f.methods}</td><td>{f.isFinalDisposal ? '○' : ''}</td>
                    <td>{admin && <Link className="btn small" href={`/masters?facility=${f.id}#facility-form`}>編集</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {admin && (
          <form action={saveFacility} id="facility-form" style={{ marginTop: 12 }}>
            <h3>{editing ? `「${editing.name}」を編集` : '処分事業場を追加'}</h3>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="form">
              <label><span className="req">名称</span><input name="name" defaultValue={editing?.name} required /></label>
              <label><span className="req">所在地</span><input name="address" defaultValue={editing?.address} required /></label>
              <label>処分業の許可番号<input name="permitNo" defaultValue={editing?.permitNo} /></label>
              <label>許可自治体<input name="permitAuthority" defaultValue={editing?.permitAuthority} /></label>
              <label>許可の有効期限<input type="date" name="permitExpiry" defaultValue={editing?.permitExpiry ?? ''} /></label>
              <label>処分方法（カンマ区切り）<input name="methods" defaultValue={editing?.methods} placeholder="破砕,選別" /></label>
              <label className="check"><input type="checkbox" name="isFinalDisposal" defaultChecked={editing?.isFinalDisposal} />最終処分場（埋立）</label>
              {editing && <label className="check"><input type="checkbox" name="active" defaultChecked={editing.active} />使用中</label>}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary">{editing ? '保存' : '追加'}</button>
              {editing && <Link className="btn" href="/masters">キャンセル</Link>}
            </div>
          </form>
        )}
      </div>
    </>
  );
}
