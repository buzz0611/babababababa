import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { cancelJwnetMessage, importJwnetCsv, markJwnetManualDone, sendJwnetMessage } from '@/actions/jwnet';
import { Flash, type SP } from '@/components/ui';
import { db, schema } from '@/db';
import { getCompany, listFacilities } from '@/lib/data';
import { IMPORT_COLUMNS } from '@/lib/jwnet/csv';
import { getGateway } from '@/lib/jwnet/gateway';
import { KIND_LABEL, type JwnetPayload } from '@/lib/jwnet/payload';

const STATUS: Record<string, [string, string]> = {
  pending: ['未送信', 'warn'], sent: ['送信済', 'info'], accepted: ['受付済', 'ok'], error: ['エラー', 'bad'], manual_done: ['手入力済', 'ok'],
};
const MODE_LABEL = { mock: 'モック（開発・デモ用）', manual: '手入力（JWNET画面で入力）', edi: 'EDI接続' };

export default async function JwnetPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const gw = getGateway();
  const [msgs, facilities, company] = await Promise.all([
    db.select().from(schema.jwnetMessages).orderBy(desc(schema.jwnetMessages.id)).limit(200),
    listFacilities(true), getCompany(),
  ]);
  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <h1>JWNET連携</h1>
        <p>接続モード：<span className="tag info">{MODE_LABEL[gw.mode]}</span>　加入者番号：{company.jwnetSubscriberNo || <span className="tag bad">未設定</span>}</p>
        <div className="note">
          電子マニフェストの処分終了報告・最終処分終了報告、二次マニフェストの登録は、ここに「送信キュー」として溜まります。
          {gw.mode === 'manual' && ' 手入力モードでは、表示された内容をJWNETの画面で入力し「入力済にする」を押してください。'}
          {gw.mode === 'mock' && ' 現在はモックのため、送信すると実際にはJWNETへ送られずに受付済になります。'}
          <br />2027年4月1日からは処分終了報告に「処分事業場・処分方法・処分量・中間処理後物の種類と量」が必須になるため、送信前にチェックしています。
        </div>
      </div>

      <div className="card">
        <h2>送信キュー</h2>
        {msgs.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>#</th><th>状態</th><th>種別</th><th>番号</th><th>作成</th><th>結果</th><th>操作</th></tr></thead>
              <tbody>
                {msgs.map((m) => {
                  const p = m.payload as JwnetPayload;
                  const [label, cls] = STATUS[m.status];
                  const href = m.manifestId ? `/manifests/${m.manifestId}` : m.secondaryId ? `/secondary/${m.secondaryId}` : '#';
                  const open = m.status === 'pending' || m.status === 'error';
                  return (
                    <tr key={m.id}>
                      <td>{m.id}</td>
                      <td><span className={`tag ${cls}`}>{label}</span></td>
                      <td>{KIND_LABEL[m.kind]}</td>
                      <td><Link href={href}>{p.report.manifestNo}</Link></td>
                      <td className="nowrap">{m.createdAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                      <td>
                        {m.response}
                        <details><summary>送信内容</summary><pre className="payload">{JSON.stringify(p.report, null, 2)}</pre></details>
                      </td>
                      <td className="nowrap">
                        {open && (
                          <div className="row">
                            {gw.mode !== 'manual' && <form action={sendJwnetMessage}><input type="hidden" name="id" value={m.id} /><button className="btn small primary">送信</button></form>}
                            <form action={markJwnetManualDone}><input type="hidden" name="id" value={m.id} /><button className="btn small">入力済にする</button></form>
                            {m.status === 'pending' && <form action={cancelJwnetMessage}><input type="hidden" name="id" value={m.id} /><button className="btn small danger">取消</button></form>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">送信キューは空です。電子マニフェストの詳細画面から追加できます。</div>}
      </div>

      <div className="card" id="import">
        <h2>マニフェスト情報の取込（CSV）</h2>
        <p className="muted">JWNETからダウンロードしたマニフェスト情報などのCSVを、受託マニフェスト（電子）として取り込みます。登録済みの番号はスキップします。排出事業者・運搬業者が未登録なら自動で追加します。文字コードはUTF-8／Shift_JISに対応しています。</p>
        <form action={importJwnetCsv} className="row">
          <select name="facilityId" style={{ maxWidth: 200 }} required>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input type="file" name="file" accept=".csv,text/csv" required style={{ maxWidth: 320 }} />
          <button className="btn primary">取り込む</button>
        </form>
        <details style={{ marginTop: 8 }}>
          <summary>CSVの列（見出し名）</summary>
          <table>
            <thead><tr><th>項目</th><th>受け付ける見出し</th></tr></thead>
            <tbody>
              {Object.entries(IMPORT_COLUMNS).map(([k, names]) => (
                <tr key={k}><td>{names[0]}{['manifestNo', 'issueDate', 'emitterName', 'wasteType'].includes(k) && <span className="req" />}</td><td>{names.join('、')}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </>
  );
}
