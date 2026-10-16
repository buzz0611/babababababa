import Link from 'next/link';
import { notFound } from 'next/navigation';
import { completeManifestTask, deleteManifest, queueManifestReport } from '@/actions/manifests';
import { ConfirmButton } from '@/components/ConfirmButton';
import { TaskPanel } from '@/components/TaskPanel';
import { D, Flash, Q, StateTag, type SP } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { linksForManifest, loadManifests, loadSecondaries } from '@/lib/data';
import { MEDIUM_LABEL } from '@/lib/domain/constants';
import { ManifestForm } from '../ManifestForm';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export default async function ManifestDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const [m] = await loadManifests({ ids: [Number(id) || 0] });
  if (!m) notFound();
  const links = await linksForManifest(m.id);
  const secs = await loadSecondaries({ ids: links.map((l) => l.secondaryId) });
  const msgs = await db.select().from(schema.jwnetMessages).where(eq(schema.jwnetMessages.manifestId, m.id));

  const jwnetButton = (kind: 'disposal_end' | 'final_disposal_end') => (
    <form action={queueManifestReport}>
      <input type="hidden" name="id" value={m.id} />
      <input type="hidden" name="kind" value={kind} />
      <button className="btn small primary">JWNET送信キューへ</button>
    </form>
  );

  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <div className="row">
          <h1 style={{ margin: 0 }}>{MEDIUM_LABEL[m.medium]}マニフェスト {m.manifestNo}</h1>
          <StateTag state={m.state} />
          <span className="spacer" />
          <Link className="btn" href="/manifests">一覧へ</Link>
          <Link className="btn" href={`/secondary/new?from=${m.id}`}>二次マニフェストを作成</Link>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {m.emitterName}{m.siteName && `（${m.siteName}）`} ／ {m.wasteType}{m.wasteName && `・${m.wasteName}`} ／ 交付 <D d={m.issueDate} /> ／ 受入 <D d={m.receivedDate} />（<Q q={m.receivedQtyT} />） ／ {m.facilityName}
        </p>
      </div>

      <div className="card">
        <h2>手続きと期限</h2>
        <TaskPanel
          tasks={m.tasks}
          id={m.id}
          action={completeManifestTask}
          extra={(t) => m.medium === 'electronic' && !t.doneDate && t.due
            ? jwnetButton(t.key === 'final_report' ? 'final_disposal_end' : 'disposal_end')
            : null}
        />
        {msgs.length > 0 && (
          <p className="muted">JWNET送信：{msgs.map((x) => `#${x.id} ${x.status}`).join('、')}（<Link href="/jwnet">JWNET連携</Link>）</p>
        )}
      </div>

      <div className="card">
        <h2>二次マニフェスト（処分後物の持出）</h2>
        {secs.length ? (
          <table>
            <thead><tr><th>番号</th><th>交付日</th><th>種類</th><th className="num">按分量</th><th>委託先</th><th>最終処分</th></tr></thead>
            <tbody>
              {secs.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/secondary/${s.id}`}>{s.manifestNo}</Link></td>
                  <td><D d={s.issueDate} /></td><td>{s.wasteType}</td>
                  <td className="num"><Q q={links.find((l) => l.secondaryId === s.id)?.allocatedQtyT} /></td>
                  <td>{s.disposerName}</td>
                  <td>{s.eDate ? <><D d={s.finalDisposalDate} /> {s.finalDisposalPlace}</> : <span className="tag">待ち</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">{m.isFinalFacility ? '自社の最終処分場で処分するため、二次マニフェストは不要です。' : 'まだ紐付いていません。処分後物を委託したら二次マニフェストを作成してください。'}</p>}
      </div>

      <div className="card">
        <h2>編集</h2>
        <ManifestForm m={m} />
      </div>

      {user.role === 'admin' && (
        <form action={deleteManifest} className="noprint">
          <input type="hidden" name="id" value={m.id} />
          <ConfirmButton message="このマニフェストを削除しますか？保存義務期間中の記録は削除しないでください。">削除</ConfirmButton>
        </form>
      )}
    </>
  );
}
