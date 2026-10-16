import Link from 'next/link';
import { saveManifest } from '@/actions/manifests';
import type { Manifest } from '@/db/schema';
import { ALL_WASTE_TYPES, DISPOSAL_METHODS, UNITS } from '@/lib/domain/constants';
import { listEmitterSites, listFacilities, listPartners } from '@/lib/data';
import { todayJst } from '@/lib/domain/dates';

export async function ManifestForm({ m }: { m?: Manifest }) {
  const [facilities, emitters, transporters, sites] = await Promise.all([
    listFacilities(), listPartners('emitter'), listPartners('transporter'), listEmitterSites(),
  ]);
  const v = (k: keyof Manifest) => (m?.[k] ?? '') as string | number;
  const dateField = (k: keyof Manifest, label: string) => (
    <label>{label}<input type="date" name={k} defaultValue={v(k) as string} /></label>
  );
  const medium = m?.medium ?? 'paper';
  return (
    <form action={saveManifest}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <fieldset>
        <legend>マニフェスト</legend>
        <div className="form">
          <label><span className="req">区分</span>
            <select name="medium" defaultValue={medium}><option value="paper">紙マニフェスト</option><option value="electronic">電子マニフェスト</option></select>
          </label>
          <label><span className="req">交付番号／登録番号</span><input name="manifestNo" defaultValue={v('manifestNo')} required /></label>
          <label><span className="req">交付年月日／引渡し日</span><input type="date" name="issueDate" defaultValue={(v('issueDate') as string) || todayJst()} required /></label>
          <label><span className="req">処分事業場（自社）</span>
            <select name="facilityId" defaultValue={v('facilityId')} required>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}{f.active ? '' : '（停止中）'}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>排出事業者・運搬</legend>
        <div className="form">
          <label><span className="req">排出事業者</span>
            <select name="emitterId" defaultValue={v('emitterId')} required>
              <option value="">選択してください</option>
              {emitters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>排出事業場
            <select name="emitterSiteId" defaultValue={v('emitterSiteId')}>
              <option value="">（未指定）</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{emitters.find((e) => e.id === s.partnerId)?.name}／{s.name}</option>)}
            </select>
          </label>
          <label>収集運搬業者
            <select name="transporterId" defaultValue={v('transporterId')}>
              <option value="">（自己搬入）</option>
              {transporters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <p className="muted">取引先が一覧にないときは <Link href="/masters/partners">取引先マスタ</Link> で追加してください。</p>
      </fieldset>
      <fieldset>
        <legend>産業廃棄物</legend>
        <div className="form">
          <label><span className="req">種類</span>
            <select name="wasteType" defaultValue={v('wasteType')} required>
              <option value="">選択してください</option>
              {ALL_WASTE_TYPES.map((w) => <option key={w}>{w}</option>)}
            </select>
          </label>
          <label>名称<input name="wasteName" defaultValue={v('wasteName')} placeholder="例：廃塗料" /></label>
          <label>マニフェスト記載数量<input name="declaredQty" inputMode="decimal" defaultValue={v('declaredQty')} /></label>
          <label>単位<select name="declaredUnit" defaultValue={v('declaredUnit') || 't'}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label>荷姿<input name="packaging" defaultValue={v('packaging')} /></label>
          <label className="check"><input type="checkbox" name="special" defaultChecked={m?.special} />特別管理産業廃棄物</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>受入れ・処分（帳簿に記載）</legend>
        <div className="form">
          {dateField('receivedDate', '受入日')}
          <label>受入量（t・計量値）<input name="receivedQtyT" inputMode="decimal" defaultValue={v('receivedQtyT')} /></label>
          <label>処分方法
            <input name="disposalMethod" list="methods" defaultValue={v('disposalMethod')} />
          </label>
          {dateField('disposalEndDate', '処分終了日')}
          <label>処分量（t）<input name="disposedQtyT" inputMode="decimal" defaultValue={v('disposedQtyT')} /></label>
        </div>
        <datalist id="methods">{DISPOSAL_METHODS.map((d) => <option key={d} value={d} />)}</datalist>
      </fieldset>
      <fieldset>
        <legend>処分終了の通知</legend>
        <div className="form">
          {dateField('c2SentDate', '紙：C2票送付日（運搬業者へ）')}
          {dateField('dSentDate', '紙：D票送付日（排出事業者へ）')}
          {dateField('disposalReportedDate', '電子：処分終了報告日')}
        </div>
      </fieldset>
      <fieldset>
        <legend>最終処分</legend>
        <div className="form">
          {dateField('finalNoticeReceivedDate', '最終処分終了の報告を受けた日')}
          {dateField('finalDisposalDate', '最終処分終了日')}
          <label>最終処分の場所<input name="finalDisposalPlace" defaultValue={v('finalDisposalPlace')} /></label>
          {dateField('eSentDate', '紙：E票送付日')}
          {dateField('finalReportedDate', '電子：最終処分終了報告日')}
        </div>
        <p className="muted">二次マニフェストのE票（最終処分終了）を受領すると、紐付いた受託マニフェストに自動で反映されます。</p>
      </fieldset>
      <fieldset>
        <legend>備考</legend>
        <textarea name="note" defaultValue={v('note')} />
      </fieldset>
      <div className="row">
        <button className="btn primary">保存</button>
        <Link className="btn" href={m ? `/manifests/${m.id}` : '/manifests'}>キャンセル</Link>
      </div>
    </form>
  );
}
