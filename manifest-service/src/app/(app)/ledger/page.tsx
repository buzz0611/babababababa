import Link from 'next/link';
import { closeLedgerYear, reopenLedgerYear } from '@/actions/ledger';
import { ConfirmButton } from '@/components/ConfirmButton';
import { PrintButton } from '@/components/PrintButton';
import { D, Flash, Q, type SP } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { closedYears, getCompany, listFacilities } from '@/lib/data';
import { jp } from '@/lib/domain/dates';
import { loadLedger, parseLedgerQuery } from '@/lib/ledger-data';

export default async function LedgerPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [user, facilities, company] = await Promise.all([requireUser(), listFacilities(), getCompany()]);
  if (!facilities.length) return <div className="card"><p>先に <Link href="/masters">マスタ</Link> で処分事業場を登録してください。</p></div>;
  const q = await parseLedgerQuery(sp, facilities[0].id);
  const facility = facilities.find((f) => f.id === q.facilityId) ?? facilities[0];
  const { ledger, range, fiscalYearOfRange } = await loadLedger({ ...q, facilityId: facility.id });
  const closed = (await closedYears(facility.id)).has(fiscalYearOfRange);
  const qs = new URLSearchParams({ facility: String(facility.id), period: q.period, month: q.month, year: String(q.year) }).toString();
  const back = `/ledger?${qs}`;
  const years = Array.from({ length: 7 }, (_, i) => q.year + 1 - i);

  const Summary = ({ title, keyLabel, rows }: { title: string; keyLabel: string; rows: typeof ledger.byEmitter }) => (
    <div>
      <h3>{title}</h3>
      {rows.length ? (
        <table>
          <thead><tr><th>{keyLabel}</th><th>種類</th><th className="num">件数</th><th className="num">数量</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.key}</td><td>{r.wasteType}</td><td className="num">{r.count}</td><td className="num"><Q q={r.qtyT} /></td></tr>)}</tbody>
        </table>
      ) : <p className="muted">該当なし</p>}
    </div>
  );

  return (
    <>
      <Flash sp={sp} />
      <div className="card noprint">
        <form className="row">
          <select name="facility" defaultValue={facility.id} style={{ maxWidth: 200 }}>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select name="period" defaultValue={q.period} style={{ maxWidth: 110 }}>
            <option value="month">月別</option><option value="year">年度</option>
          </select>
          <input type="month" name="month" defaultValue={q.month} style={{ maxWidth: 160 }} aria-label="対象月" />
          <select name="year" defaultValue={q.year} style={{ maxWidth: 120 }} aria-label="対象年度">
            {years.map((y) => <option key={y} value={y}>{y}年度</option>)}
          </select>
          <button className="btn">表示</button>
          <span className="spacer" />
          <a className="btn" href={`/ledger/csv?${qs}`}>CSV出力</a>
          <PrintButton />
        </form>
      </div>

      <div className="card">
        <h1>処分業者帳簿（{facility.name}）</h1>
        <p className="muted">
          {company.name}　許可番号 {facility.permitNo || '（未設定）'}　所在地 {facility.address}<br />
          対象期間 {jp(range.from)} 〜 {jp(range.to)}（{fiscalYearOfRange}年度）
          {closed ? <span className="tag ok" style={{ marginLeft: 8 }}>閉鎖済</span> : <span className="tag" style={{ marginLeft: 8 }}>記載中</span>}
        </p>
        {ledger.issues.length > 0 && (
          <div className="flash error">記載漏れ：{ledger.issues.join(' ／ ')}</div>
        )}
        <div className="stats">
          <div className="stat"><div className="n"><Q q={ledger.totals.receivedT} /></div><div className="l">受入量</div></div>
          <div className="stat"><div className="n"><Q q={ledger.totals.disposedT} /></div><div className="l">処分量</div></div>
          <div className="stat"><div className="n"><Q q={ledger.totals.shippedT} /></div><div className="l">持出量</div></div>
        </div>
        <h2>明細</h2>
        {ledger.entries.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>年月日</th><th>区分</th><th>管理票交付者／委託先</th><th>交付年月日</th><th>交付番号</th><th>廃棄物の種類</th><th>処分方法／持出先</th><th className="num">数量</th></tr></thead>
              <tbody>
                {ledger.entries.map((e, i) => (
                  <tr key={i}>
                    <td className="nowrap"><D d={e.date} /></td>
                    <td><span className={`tag ${e.kind === '受入' ? 'info' : e.kind === '処分' ? 'ok' : 'warn'}`}>{e.kind}</span></td>
                    <td>{e.party}</td><td className="nowrap"><D d={e.issueDate} /></td><td>{e.manifestNo}</td>
                    <td>{e.wasteType}</td><td>{e.method}</td><td className="num"><Q q={e.qtyT} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">この期間の記載事項はありません</div>}
        <div className="cols" style={{ marginTop: 12 }}>
          <Summary title="受入先ごとの受入量" keyLabel="受入先（排出事業者）" rows={ledger.byEmitter} />
          <Summary title="処分方法ごとの処分量" keyLabel="処分方法" rows={ledger.byMethod} />
          <Summary title="持出先ごとの持出量" keyLabel="持出先" rows={ledger.byDestination} />
        </div>
        <p className="muted">帳簿は事業場ごとに備え付け、翌月末までに記載し、1年ごとに閉鎖して閉鎖後5年間保存します（施行規則第10条の8）。</p>
      </div>

      {user.role === 'admin' && (
        <div className="card noprint">
          <h2>{fiscalYearOfRange}年度の帳簿の閉鎖</h2>
          {closed ? (
            <form action={reopenLedgerYear} className="row">
              <input type="hidden" name="facilityId" value={facility.id} />
              <input type="hidden" name="fiscalYear" value={fiscalYearOfRange} />
              <input type="hidden" name="back" value={back} />
              <input name="reason" placeholder="再開する理由（操作履歴に残ります）" style={{ maxWidth: 360 }} required />
              <button className="btn danger">閉鎖を取り消す</button>
            </form>
          ) : (
            <form action={closeLedgerYear} className="row">
              <input type="hidden" name="facilityId" value={facility.id} />
              <input type="hidden" name="fiscalYear" value={fiscalYearOfRange} />
              <input type="hidden" name="back" value={back} />
              <span className="muted">閉鎖すると、この年度に受入・処分したマニフェストは変更できなくなります。</span>
              <ConfirmButton className="btn primary" message={`${fiscalYearOfRange}年度の帳簿を閉鎖しますか？`}>閉鎖する</ConfirmButton>
            </form>
          )}
        </div>
      )}
    </>
  );
}
