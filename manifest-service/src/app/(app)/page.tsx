import Link from 'next/link';
import { completeManifestTask } from '@/actions/manifests';
import { completeSecondaryTask } from '@/actions/secondary';
import { D, Flash, StateTag, type SP } from '@/components/ui';
import { getCompany, listFacilities, listPartners, loadManifests, loadSecondaries } from '@/lib/data';
import { diffDays, todayJst } from '@/lib/domain/dates';
import type { Task } from '@/lib/domain/deadlines';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

type Alert = { task: Task; href: string; no: string; party: string; what: string; id: number; source: 'manifest' | 'secondary' };

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const today = todayJst();
  const [ms, ss, company, facilities, partners, pending] = await Promise.all([
    loadManifests(), loadSecondaries(), getCompany(), listFacilities(true), listPartners(),
    db.select().from(schema.jwnetMessages).where(eq(schema.jwnetMessages.status, 'pending')),
  ]);

  const alerts: Alert[] = [
    ...ms.flatMap((m) => m.tasks.map((task) => ({ task, href: `/manifests/${m.id}`, no: m.manifestNo, party: m.emitterName, what: `受託・${m.medium === 'paper' ? '紙' : '電子'}`, id: m.id, source: 'manifest' as const }))),
    ...ss.flatMap((s) => s.tasks.map((task) => ({ task, href: `/secondary/${s.id}`, no: s.manifestNo, party: s.disposerName, what: `二次・${s.medium === 'paper' ? '紙' : '電子'}`, id: s.id, source: 'secondary' as const }))),
  ].filter((a) => a.task.state === 'overdue' || a.task.state === 'soon')
    .sort((a, b) => a.task.due!.localeCompare(b.task.due!));

  const overdue = alerts.filter((a) => a.task.state === 'overdue').length;
  const notReceivedQty = ms.filter((m) => m.receivedDate && m.receivedQtyT == null).length;
  const inProcess = ms.filter((m) => m.receivedDate && !m.disposalEndDate).length;
  const waitingFinal = ms.filter((m) => m.disposalEndDate && !m.finalDisposalDate).length;

  const expiries = [
    ...facilities.map((f) => ({ name: `自社 ${f.name}`, what: '処分業許可', date: f.permitExpiry, href: '/masters' })),
    ...partners.map((p) => ({ name: p.name, what: '業許可', date: p.permitExpiry, href: `/masters/partners/${p.id}` })),
    ...(await db.select({ c: schema.contracts, name: schema.partners.name }).from(schema.contracts)
      .innerJoin(schema.partners, eq(schema.partners.id, schema.contracts.partnerId)))
      .map(({ c, name }) => ({ name, what: `委託契約「${c.title}」`, date: c.endDate, href: `/masters/partners/${c.partnerId}` })),
  ].filter((x) => x.date && diffDays(today, x.date) <= 90).sort((a, b) => a.date!.localeCompare(b.date!));

  const setupMissing = !company.name || facilities.length === 0;

  return (
    <>
      <Flash sp={sp} />
      {setupMissing && (
        <div className="flash error">はじめに <Link href="/masters">マスタ</Link> で自社情報と処分事業場を登録してください。</div>
      )}
      <div className="stats">
        <div className={`stat ${overdue ? 'bad' : ''}`}><div className="n">{overdue}</div><div className="l">期限超過の手続き</div></div>
        <div className={`stat ${alerts.length - overdue ? 'warn' : ''}`}><div className="n">{alerts.length - overdue}</div><div className="l">期限間近の手続き</div></div>
        <Link className="stat" href="/manifests?status=in_process"><div className="n">{inProcess}</div><div className="l">受入済・処分中</div></Link>
        <Link className="stat" href="/manifests?status=waiting_final"><div className="n">{waitingFinal}</div><div className="l">最終処分終了待ち</div></Link>
        <Link className={`stat ${pending.length ? 'warn' : ''}`} href="/jwnet"><div className="n">{pending.length}</div><div className="l">JWNET未送信</div></Link>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>要対応の手続き</h2>
          <span className="spacer" />
          <Link className="btn primary" href="/manifests/new">＋ 受託マニフェスト登録</Link>
        </div>
        {alerts.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>状態</th><th>期限</th><th>手続き</th><th>区分</th><th>番号</th><th>相手先</th><th>措置内容等報告書</th><th className="noprint">完了登録</th></tr></thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={`${a.href}-${a.task.key}`}>
                    <td><StateTag state={a.task.state}>{a.task.state === 'overdue' ? `${-a.task.left!}日超過` : `あと${a.task.left}日`}</StateTag></td>
                    <td className="nowrap"><D d={a.task.due} /></td>
                    <td>{a.task.label}</td>
                    <td className="nowrap">{a.what}</td>
                    <td><Link href={a.href}>{a.no}</Link></td>
                    <td>{a.party}</td>
                    <td>{a.task.authorityReportDue ? <span className="tag bad"><D d={a.task.authorityReportDue} />まで</span> : '—'}</td>
                    <td className="noprint">
                      {a.task.key !== 'e' || a.source === 'manifest' ? (
                        <form action={a.source === 'manifest' ? completeManifestTask : completeSecondaryTask}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="key" value={a.task.key} />
                          <input type="hidden" name="back" value="/" />
                          <button className="btn small">今日完了</button>
                        </form>
                      ) : <Link className="btn small" href={a.href}>入力</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">期限が迫っている手続きはありません ✓</div>}
        <p className="muted">紙：処分終了日から10日以内にC2票・D票、最終処分終了の報告を受けてから10日以内にE票を送付。電子：処分終了・最終処分終了から3日以内（土日祝・年末年始を除く）にJWNETへ報告。二次マニフェストは交付日から90日（特管60日）・180日以内に返送がなければ措置内容等報告書の対象です。</p>
      </div>

      <div className="cols">
        <div className="card">
          <h2>許可・契約の期限（90日以内）</h2>
          {expiries.length ? (
            <div className="tablewrap"><table>
              <thead><tr><th>状態</th><th>対象</th><th>相手先</th><th>期限</th></tr></thead>
              <tbody>
                {expiries.map((x, i) => {
                  const l = diffDays(today, x.date!);
                  return (
                    <tr key={i}>
                      <td><span className={`tag ${l < 0 ? 'bad' : 'warn'}`}>{l < 0 ? '期限切れ' : `あと${l}日`}</span></td>
                      <td>{x.what}</td><td><Link href={x.href}>{x.name}</Link></td><td className="nowrap"><D d={x.date} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          ) : <div className="empty">期限が近いものはありません</div>}
        </div>
        <div className="card">
          <h2>帳簿の記載漏れ</h2>
          {notReceivedQty ? (
            <p><Link href="/manifests?status=no_qty">受入量が未入力のマニフェストが {notReceivedQty} 件</Link>あります。帳簿は翌月末までに記載が必要です。</p>
          ) : <div className="empty">記載漏れはありません</div>}
        </div>
      </div>
    </>
  );
}
