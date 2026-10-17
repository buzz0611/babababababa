import Link from 'next/link';
import { saveSecondary } from '@/actions/secondary';
import type { SecondaryManifest } from '@/db/schema';
import { listFacilities, listPartners, loadManifests } from '@/lib/data';
import { ALL_WASTE_TYPES, DISPOSAL_METHODS } from '@/lib/domain/constants';
import { jp, todayJst } from '@/lib/domain/dates';

export async function SecondaryForm({ s, links = [], preselect }: {
  s?: SecondaryManifest;
  links?: { manifestId: number; allocatedQtyT: number | null }[];
  preselect?: number;
}) {
  const [facilities, transporters, disposers, manifests] = await Promise.all([
    listFacilities(), listPartners('transporter'), listPartners('disposer'), loadManifests(),
  ]);
  const linked = new Map(links.map((l) => [l.manifestId, l.allocatedQtyT]));
  const pre = manifests.find((m) => m.id === preselect);
  // 紐付け候補：処分済み・最終処分前の受託分（＋既に紐付いているもの）
  const candidates = manifests
    .filter((m) => linked.has(m.id) || m.id === preselect || (m.disposalEndDate && !m.isFinalFacility && !m.finalNoticeReceivedDate))
    .slice(0, 300);
  const v = (k: keyof SecondaryManifest) => (s?.[k] ?? '') as string | number;
  const date = (k: keyof SecondaryManifest, label: string) => <label>{label}<input type="date" name={k} defaultValue={v(k) as string} /></label>;
  return (
    <form action={saveSecondary}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <fieldset>
        <legend>マニフェスト（自社が排出事業者として交付）</legend>
        <div className="form">
          <label><span className="req">区分</span>
            <select name="medium" defaultValue={s?.medium ?? 'paper'}><option value="paper">紙マニフェスト</option><option value="electronic">電子マニフェスト</option></select>
          </label>
          <label><span className="req">交付番号／登録番号</span><input name="manifestNo" defaultValue={v('manifestNo')} required inputMode="numeric" placeholder="紙は11桁（例：50123005015）" /></label>
          <label><span className="req">交付日／引渡し日</span><input type="date" name="issueDate" defaultValue={(v('issueDate') as string) || todayJst()} required /></label>
          {date('registeredDate', '電子：JWNET登録日')}
          <label><span className="req">排出事業場（自社の処分事業場）</span>
            <select name="facilityId" defaultValue={v('facilityId') || pre?.facilityId}>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>処分後物</legend>
        <div className="form">
          <label><span className="req">種類</span>
            <select name="wasteType" defaultValue={v('wasteType')} required>
              <option value="">選択してください</option>
              {ALL_WASTE_TYPES.map((w) => <option key={w}>{w}</option>)}
            </select>
          </label>
          <label>名称<input name="wasteName" defaultValue={v('wasteName')} placeholder="例：破砕後廃プラ" /></label>
          <label><span className="req">持出量（t）</span><input name="qtyT" inputMode="decimal" defaultValue={v('qtyT')} required /></label>
          <label className="check"><input type="checkbox" name="special" defaultChecked={s?.special} />特別管理産業廃棄物</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>委託先</legend>
        <div className="form">
          <label>収集運搬業者
            <select name="transporterId" defaultValue={v('transporterId')}>
              <option value="">（なし）</option>
              {transporters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label><span className="req">処分業者</span>
            <select name="disposerId" defaultValue={v('disposerId')} required>
              <option value="">選択してください</option>
              {disposers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>持出先（処分事業場の所在地）<input name="destAddress" defaultValue={v('destAddress')} /></label>
          <label>処分方法<input name="disposalMethod" list="methods2" defaultValue={v('disposalMethod')} /></label>
          <label className="check"><input type="checkbox" name="isFinal" defaultChecked={s ? s.isFinal : true} />委託先で最終処分する</label>
        </div>
        <datalist id="methods2">{DISPOSAL_METHODS.map((d) => <option key={d} value={d} />)}</datalist>
      </fieldset>
      <fieldset>
        <legend>返送票・終了報告の受領</legend>
        <div className="form">
          {date('b2Date', 'B2票／運搬終了報告')}
          {date('dDate', 'D票／処分終了報告')}
          {date('eDate', 'E票／最終処分終了報告')}
          {date('finalDisposalDate', '最終処分終了日')}
          <label>最終処分の場所<input name="finalDisposalPlace" defaultValue={v('finalDisposalPlace')} /></label>
          {date('reportedToAuthority', '措置内容等報告書の提出日')}
        </div>
        <p className="muted">E票（最終処分終了）を受領したら、受領日・最終処分終了日・場所を入れて保存すると、下で紐付けた受託マニフェストに反映されます。</p>
      </fieldset>
      <fieldset>
        <legend>元の受託マニフェスト（紐付け）</legend>
        {candidates.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>紐付け</th><th>番号</th><th>排出事業者</th><th>種類</th><th>処分終了</th><th className="num">処分量</th><th>按分量（t）</th></tr></thead>
              <tbody>
                {candidates.map((m) => (
                  <tr key={m.id}>
                    <td><input type="checkbox" name={`link_${m.id}`} defaultChecked={linked.has(m.id) || m.id === preselect} aria-label={`${m.manifestNo}を紐付け`} /></td>
                    <td><Link href={`/manifests/${m.id}`}>{m.manifestNo}</Link></td>
                    <td>{m.emitterName}</td><td>{m.wasteType}</td>
                    <td>{jp(m.disposalEndDate) || '処分中'}</td>
                    <td className="num">{m.disposedQtyT ?? '—'}</td>
                    <td><input name={`alloc_${m.id}`} inputMode="decimal" defaultValue={linked.get(m.id) ?? ''} style={{ width: 100 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">紐付けできる受託マニフェスト（処分終了済み・最終処分前）がありません。</p>}
      </fieldset>
      <fieldset>
        <legend>備考</legend>
        <textarea name="note" defaultValue={v('note')} />
      </fieldset>
      <div className="row">
        <button className="btn primary">保存</button>
        <Link className="btn" href={s ? `/secondary/${s.id}` : '/secondary'}>キャンセル</Link>
      </div>
    </form>
  );
}
