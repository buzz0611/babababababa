import Link from 'next/link';
import { D, Flash, one, Q, TaskTags, type SP } from '@/components/ui';
import { listFacilities, loadManifests } from '@/lib/data';
import { MEDIUM_LABEL } from '@/lib/domain/constants';

const STATUS: Record<string, string> = {
  attention: '要対応（超過・間近）',
  in_process: '受入済・処分中',
  waiting_final: '最終処分終了待ち',
  not_received: '未受入',
  no_qty: '受入量未入力',
  done: 'すべて完了',
};

export default async function ManifestList({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q).toLowerCase();
  const facility = one(sp.facility);
  const status = one(sp.status);
  const medium = one(sp.medium);
  const month = one(sp.month);
  const [all, facilities] = await Promise.all([loadManifests(), listFacilities()]);
  const list = all.filter((m) => {
    if (facility && String(m.facilityId) !== facility) return false;
    if (medium && m.medium !== medium) return false;
    if (month && !(m.receivedDate ?? m.issueDate).startsWith(month)) return false;
    if (status === 'attention' && !['overdue', 'soon'].includes(m.state)) return false;
    if (status === 'in_process' && !(m.receivedDate && !m.disposalEndDate)) return false;
    if (status === 'waiting_final' && !(m.disposalEndDate && !m.finalDisposalDate)) return false;
    if (status === 'not_received' && m.receivedDate) return false;
    if (status === 'no_qty' && !(m.receivedDate && m.receivedQtyT == null)) return false;
    if (status === 'done' && m.state !== 'done' && m.state !== 'late_done') return false;
    if (q && ![m.manifestNo, m.emitterName, m.siteName, m.transporterName, m.wasteType, m.wasteName, m.note].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>受託マニフェスト</h1>
          <span className="spacer" />
          <Link className="btn" href="/jwnet#import">JWNETから取込</Link>
          <Link className="btn primary" href="/manifests/new">＋ 登録</Link>
        </div>
        <form className="row noprint" style={{ marginBottom: 12 }}>
          <input name="q" defaultValue={one(sp.q)} placeholder="番号・排出事業者・種類で検索" style={{ maxWidth: 240 }} />
          <select name="facility" defaultValue={facility} style={{ maxWidth: 180 }}>
            <option value="">全事業場</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select name="status" defaultValue={status} style={{ maxWidth: 190 }}>
            <option value="">すべての状態</option>
            {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select name="medium" defaultValue={medium} style={{ maxWidth: 110 }}>
            <option value="">紙・電子</option><option value="paper">紙</option><option value="electronic">電子</option>
          </select>
          <input type="month" name="month" defaultValue={month} style={{ maxWidth: 160 }} title="受入月" />
          <button className="btn">絞り込み</button>
        </form>
        {list.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>区分</th><th>番号</th><th>交付日</th><th>排出事業者</th><th>種類</th><th>受入日</th><th className="num">受入量</th><th>処分</th><th>手続き</th></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td><span className={`tag ${m.medium === 'electronic' ? 'info' : ''}`}>{MEDIUM_LABEL[m.medium]}</span></td>
                    <td><Link href={`/manifests/${m.id}`}>{m.manifestNo}</Link></td>
                    <td className="nowrap"><D d={m.issueDate} /></td>
                    <td>{m.emitterName}{m.siteName && <div className="muted">{m.siteName}</div>}</td>
                    <td>{m.special && <span className="tag bad">特管</span>} {m.wasteType}</td>
                    <td className="nowrap"><D d={m.receivedDate} /></td>
                    <td className="num"><Q q={m.receivedQtyT} /></td>
                    <td className="nowrap">{m.disposalEndDate ? <>{m.disposalMethod}<div className="muted"><D d={m.disposalEndDate} /> 終了</div></> : m.receivedDate ? <span className="tag info">処分中</span> : <span className="tag">未受入</span>}</td>
                    <td><TaskTags tasks={m.tasks} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">{list.length} 件</p>
          </div>
        ) : <div className="empty">該当するマニフェストはありません</div>}
      </div>
    </>
  );
}
