import Link from 'next/link';
import { D, Flash, one, Q, TaskTags, type SP } from '@/components/ui';
import { loadSecondaries } from '@/lib/data';
import { MEDIUM_LABEL } from '@/lib/domain/constants';

export default async function SecondaryList({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q).toLowerCase();
  const open = one(sp.open);
  const list = (await loadSecondaries()).filter((s) =>
    (!open || !s.eDate) && (!q || [s.manifestNo, s.disposerName, s.wasteType, s.destAddress].join(' ').toLowerCase().includes(q)));
  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>二次マニフェスト</h1>
          <span className="spacer" />
          <Link className="btn primary" href="/secondary/new">＋ 登録</Link>
        </div>
        <form className="row" style={{ marginBottom: 12 }}>
          <input name="q" defaultValue={one(sp.q)} placeholder="番号・委託先・種類で検索" style={{ maxWidth: 240 }} />
          <label className="row muted"><input type="checkbox" name="open" defaultChecked={!!open} />最終処分終了待ちのみ</label>
          <button className="btn">絞り込み</button>
        </form>
        {list.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>区分</th><th>番号</th><th>交付日</th><th>種類</th><th className="num">持出量</th><th>委託先</th><th>返送状況</th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td><span className={`tag ${s.medium === 'electronic' ? 'info' : ''}`}>{MEDIUM_LABEL[s.medium]}</span></td>
                    <td><Link href={`/secondary/${s.id}`}>{s.manifestNo}</Link></td>
                    <td className="nowrap"><D d={s.issueDate} /></td>
                    <td>{s.wasteType}</td>
                    <td className="num"><Q q={s.qtyT} /></td>
                    <td>{s.disposerName}<div className="muted">{s.destAddress}</div></td>
                    <td><TaskTags tasks={s.tasks} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">二次マニフェストはありません</div>}
      </div>
    </>
  );
}
