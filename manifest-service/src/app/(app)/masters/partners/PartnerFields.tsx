import type { Partner } from '@/db/schema';

export function PartnerFields({ p }: { p?: Partner }) {
  return (
    <div className="form">
      <label><span className="req">氏名又は名称</span><input name="name" defaultValue={p?.name} required /></label>
      <label>住所<input name="address" defaultValue={p?.address} /></label>
      <label>電話番号<input name="tel" defaultValue={p?.tel} /></label>
      <label>JWNET加入者番号<input name="jwnetSubscriberNo" defaultValue={p?.jwnetSubscriberNo} /></label>
      <label className="check"><input type="checkbox" name="isEmitter" defaultChecked={p?.isEmitter} />排出事業者</label>
      <label className="check"><input type="checkbox" name="isTransporter" defaultChecked={p?.isTransporter} />収集運搬業者</label>
      <label className="check"><input type="checkbox" name="isDisposer" defaultChecked={p?.isDisposer} />処分業者（二次委託先）</label>
      <label>業許可番号<input name="permitNo" defaultValue={p?.permitNo} /></label>
      <label>許可自治体<input name="permitAuthority" defaultValue={p?.permitAuthority} /></label>
      <label>許可の有効期限<input type="date" name="permitExpiry" defaultValue={p?.permitExpiry ?? ''} /></label>
      {p && <label className="check"><input type="checkbox" name="active" defaultChecked={p.active} />取引中</label>}
      <label className="wide">備考<textarea name="note" defaultValue={p?.note} /></label>
    </div>
  );
}
