/**
 * デモ用データを投入する（既存データは消去される）。本番では使わないこと。
 *   npm run db:seed
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
import * as schema from '../src/db/schema';
import { addDays, todayJst } from '../src/lib/domain/dates';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const t = todayJst();
const ago = (n: number) => addDays(t, -n);
const hash = (pw: string) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(pw, salt, 64).toString('base64')}`;
};

await db.execute(sql`truncate audit_logs, jwnet_messages, secondary_links, secondary_manifests, manifests, ledger_closures,
  contracts, emitter_sites, partners, facilities, company, sessions, users restart identity cascade`);

await db.insert(schema.users).values([
  { loginId: 'admin', name: '管理者 太郎', role: 'admin', passwordHash: hash('admin1234') },
  { loginId: 'staff', name: '受付 花子', role: 'staff', passwordHash: hash('staff1234') },
]);
await db.insert(schema.company).values({
  id: 1, name: '株式会社エコプロセス', address: '埼玉県川越市○○町1-2-3', tel: '049-000-0000', representative: '代表取締役 山本一郎',
  jwnetSubscriberNo: '2012345',
});
const [f1, f2] = await db.insert(schema.facilities).values([
  { name: '川越中間処理センター', address: '埼玉県川越市○○町1-2-3', permitNo: '01120012345', permitAuthority: '埼玉県', permitExpiry: addDays(t, 60), methods: '破砕,選別,圧縮' },
  { name: '秩父最終処分場', address: '埼玉県秩父市△△4-5', permitNo: '01120099999', permitAuthority: '埼玉県', permitExpiry: addDays(t, 1200), methods: '管理型埋立', isFinalDisposal: true },
]).returning();
const p = await db.insert(schema.partners).values([
  { name: '大和建設株式会社', address: '東京都新宿区1-1', isEmitter: true, jwnetSubscriberNo: '1000001' },
  { name: '東都電機製作所', address: '東京都大田区2-2', isEmitter: true, jwnetSubscriberNo: '1000002' },
  { name: 'みどり食品工業', address: '埼玉県所沢市3-3', isEmitter: true },
  { name: '関東運輸株式会社', address: '埼玉県川口市4-4', isTransporter: true, permitNo: '01100054321', permitAuthority: '埼玉県', permitExpiry: addDays(t, 25), jwnetSubscriberNo: '3000001' },
  { name: '首都圏ロジ株式会社', address: '東京都江東区5-5', isTransporter: true, permitNo: '01300011111', permitAuthority: '東京都', permitExpiry: addDays(t, 800), jwnetSubscriberNo: '3000002' },
  { name: '北関東エコランド株式会社', address: '栃木県那須塩原市6-6', isDisposer: true, isTransporter: true, permitNo: '00920077777', permitAuthority: '栃木県', permitExpiry: addDays(t, 500), jwnetSubscriberNo: '4000001' },
  { name: 'リサイクルメタル株式会社', address: '群馬県太田市7-7', isDisposer: true, permitNo: '01020088888', permitAuthority: '群馬県', permitExpiry: addDays(t, 700) },
]).returning();
const [daiwa, toto, midori, kanto, shuto, kitakanto, metal] = p;
const sites = await db.insert(schema.emitterSites).values([
  { partnerId: daiwa.id, name: '新宿三丁目再開発現場', address: '東京都新宿区3-3' },
  { partnerId: toto.id, name: '大田工場', address: '東京都大田区2-2' },
]).returning();
await db.insert(schema.contracts).values([
  { partnerId: daiwa.id, direction: 'inbound', title: '産業廃棄物処分委託契約', wasteTypes: 'がれき類,廃プラスチック類,混合廃棄物', startDate: ago(400), endDate: addDays(t, 40) },
  { partnerId: toto.id, direction: 'inbound', title: '産業廃棄物処分委託契約', wasteTypes: '金属くず,廃プラスチック類', startDate: ago(200), endDate: addDays(t, 500) },
  { partnerId: kitakanto.id, direction: 'outbound', title: '処分後物の最終処分委託契約', wasteTypes: '廃プラスチック類,ガラスくず', startDate: ago(300), endDate: addDays(t, 300) },
]);

type M = typeof schema.manifests.$inferInsert;
const base = (o: Partial<M>): M => ({
  facilityId: f1.id, medium: 'paper', manifestNo: '', issueDate: ago(10), emitterId: daiwa.id, emitterSiteId: sites[0].id,
  transporterId: kanto.id, wasteType: '廃プラスチック類', declaredQty: 2, declaredUnit: 't', packaging: 'バラ', ...o,
});
const ms = await db.insert(schema.manifests).values([
  // 受入前
  base({ manifestNo: 'A00000101', issueDate: ago(1) }),
  // 処分中
  base({ manifestNo: 'A00000102', issueDate: ago(6), receivedDate: ago(5), receivedQtyT: 2.34, wasteType: 'がれき類', declaredQty: 3 }),
  // 処分終了・D/C2送付期限間近
  base({ manifestNo: 'A00000103', issueDate: ago(15), receivedDate: ago(14), receivedQtyT: 1.86, disposalMethod: '破砕', disposalEndDate: ago(8), disposedQtyT: 1.86 }),
  // 処分終了・D票送付期限超過
  base({ manifestNo: 'A00000104', issueDate: ago(30), receivedDate: ago(29), receivedQtyT: 0.92, disposalMethod: '選別', disposalEndDate: ago(14), disposedQtyT: 0.92, emitterId: toto.id, emitterSiteId: sites[1].id, wasteType: '金属くず' }),
  // D送付済・最終処分待ち（二次に紐付け済）
  base({ manifestNo: 'A00000105', issueDate: ago(60), receivedDate: ago(59), receivedQtyT: 3.1, disposalMethod: '破砕', disposalEndDate: ago(50), disposedQtyT: 3.1, c2SentDate: ago(45), dSentDate: ago(45) }),
  // 最終処分の報告受領済 → E票送付期限
  base({ manifestNo: 'A00000106', issueDate: ago(90), receivedDate: ago(89), receivedQtyT: 2.0, disposalMethod: '破砕', disposalEndDate: ago(80), disposedQtyT: 2.0, c2SentDate: ago(75), dSentDate: ago(75) }),
  // 完了
  base({ manifestNo: 'A00000107', issueDate: ago(150), receivedDate: ago(149), receivedQtyT: 4.2, disposalMethod: '破砕', disposalEndDate: ago(140), disposedQtyT: 4.2, c2SentDate: ago(135), dSentDate: ago(135), finalNoticeReceivedDate: ago(60), finalDisposalDate: ago(65), finalDisposalPlace: '北関東エコランド 那須塩原処分場', eSentDate: ago(55) }),
  // 電子：処分終了報告待ち
  base({ medium: 'electronic', manifestNo: '9000123456', issueDate: ago(5), receivedDate: ago(4), receivedQtyT: 0.75, disposalMethod: '圧縮', disposalEndDate: ago(1), disposedQtyT: 0.75, emitterId: toto.id, emitterSiteId: sites[1].id, transporterId: shuto.id }),
  // 電子：処分中
  base({ medium: 'electronic', manifestNo: '9000123457', issueDate: ago(3), receivedDate: ago(2), receivedQtyT: null, emitterId: midori.id, emitterSiteId: null, transporterId: shuto.id, wasteType: '汚泥', declaredQty: 1200, declaredUnit: 'kg' }),
  // 最終処分場で埋立（自社最終処分）
  base({ facilityId: f2.id, manifestNo: 'A00000201', issueDate: ago(20), receivedDate: ago(19), receivedQtyT: 5.5, disposalMethod: '管理型埋立', disposalEndDate: ago(9), disposedQtyT: 5.5, wasteType: '燃え殻', emitterId: midori.id, emitterSiteId: null, finalDisposalDate: ago(9), finalDisposalPlace: '秩父最終処分場 埼玉県秩父市△△4-5' }),
]).returning();
const byNo = (n: string) => ms.find((m) => m.manifestNo === n)!;

const ss = await db.insert(schema.secondaryManifests).values([
  { facilityId: f1.id, medium: 'paper', manifestNo: 'S00000501', issueDate: ago(40), wasteType: '廃プラスチック類', wasteName: '破砕後廃プラ', qtyT: 2.6, transporterId: kitakanto.id, disposerId: kitakanto.id, destAddress: '栃木県那須塩原市6-6', disposalMethod: '管理型埋立', b2Date: ago(37) },
  { facilityId: f1.id, medium: 'paper', manifestNo: 'S00000502', issueDate: ago(75), wasteType: '廃プラスチック類', wasteName: '破砕後廃プラ', qtyT: 1.7, transporterId: kitakanto.id, disposerId: kitakanto.id, destAddress: '栃木県那須塩原市6-6', disposalMethod: '管理型埋立', b2Date: ago(72), dDate: ago(60), eDate: ago(3), finalDisposalDate: ago(6), finalDisposalPlace: '北関東エコランド 那須塩原処分場' },
  { facilityId: f1.id, medium: 'paper', manifestNo: 'S00000400', issueDate: ago(140), wasteType: '廃プラスチック類', qtyT: 3.9, transporterId: kitakanto.id, disposerId: kitakanto.id, destAddress: '栃木県那須塩原市6-6', disposalMethod: '管理型埋立', b2Date: ago(136), dDate: ago(100), eDate: ago(60), finalDisposalDate: ago(65), finalDisposalPlace: '北関東エコランド 那須塩原処分場' },
  { facilityId: f1.id, medium: 'paper', manifestNo: 'S00000300', issueDate: ago(100), wasteType: '金属くず', qtyT: 0.5, transporterId: kanto.id, disposerId: metal.id, destAddress: '群馬県太田市7-7', disposalMethod: '選別', isFinal: false, b2Date: ago(98) },
]).returning();
await db.insert(schema.secondaryLinks).values([
  { secondaryId: ss[0].id, manifestId: byNo('A00000105').id, allocatedQtyT: 2.6 },
  { secondaryId: ss[1].id, manifestId: byNo('A00000106').id, allocatedQtyT: 1.7 },
  { secondaryId: ss[2].id, manifestId: byNo('A00000107').id, allocatedQtyT: 3.9 },
]);
// S00000502 のE票受領を一次に反映（アプリでは保存時に自動反映される）
await db.update(schema.manifests).set({ finalNoticeReceivedDate: ago(3), finalDisposalDate: ago(6), finalDisposalPlace: '北関東エコランド 那須塩原処分場' })
  .where(sql`id = ${byNo('A00000106').id}`);

await pool.end();
console.log('デモデータを投入しました。ログイン: admin / admin1234（管理者）, staff / staff1234（一般）');
