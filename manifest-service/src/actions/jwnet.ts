'use server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { todayJst } from '@/lib/domain/dates';
import { ALL_WASTE_TYPES } from '@/lib/domain/constants';
import { optInt, str, withMsg } from '@/lib/form';
import { readImportRows } from '@/lib/jwnet/csv';
import { getGateway } from '@/lib/jwnet/gateway';
import type { JwnetPayload } from '@/lib/jwnet/payload';

const { jwnetMessages } = schema;

/** 報告が受け付けられたら、マニフェスト側の報告日を埋める */
async function applyAccepted(msg: typeof jwnetMessages.$inferSelect, date: string) {
  if (msg.kind === 'disposal_end' && msg.manifestId) {
    const p = msg.payload as Extract<JwnetPayload, { kind: 'disposal_end' }>;
    await db.update(schema.manifests).set({
      disposalReportedDate: date,
      ...(p.report.isFinalDisposal ? { finalReportedDate: date } : {}),
      updatedAt: new Date(),
    }).where(eq(schema.manifests.id, msg.manifestId));
  } else if (msg.kind === 'final_disposal_end' && msg.manifestId) {
    await db.update(schema.manifests).set({ finalReportedDate: date, updatedAt: new Date() }).where(eq(schema.manifests.id, msg.manifestId));
  } else if (msg.kind === 'register_secondary' && msg.secondaryId) {
    await db.update(schema.secondaryManifests).set({ registeredDate: date, updatedAt: new Date() }).where(eq(schema.secondaryManifests.id, msg.secondaryId));
  }
}

export async function sendJwnetMessage(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  const [msg] = await db.select().from(jwnetMessages).where(eq(jwnetMessages.id, id));
  if (!msg || !['pending', 'error'].includes(msg.status)) redirect('/jwnet');
  const gw = getGateway();
  const res = await gw.send(msg.payload as JwnetPayload);
  const status = res.status === 'manual' ? 'pending' : res.status;
  await db.update(jwnetMessages).set({ status, response: res.message, sentAt: res.status === 'manual' ? null : new Date() }).where(eq(jwnetMessages.id, id));
  if (status === 'accepted') await applyAccepted(msg, todayJst());
  await audit(user.id, 'send', 'jwnet_message', id, { status: msg.status }, { status, response: res.message });
  redirect(withMsg('/jwnet', status === 'error' ? 'error' : 'ok', res.message));
}

/** JWNETのWeb画面で手入力した場合に完了扱いにする */
export async function markJwnetManualDone(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  const [msg] = await db.select().from(jwnetMessages).where(eq(jwnetMessages.id, id));
  if (!msg) redirect('/jwnet');
  const date = todayJst();
  await db.update(jwnetMessages).set({ status: 'manual_done', response: `${user.name} がJWNET画面で入力済`, sentAt: new Date() }).where(eq(jwnetMessages.id, id));
  await applyAccepted(msg, date);
  await audit(user.id, 'manual_done', 'jwnet_message', id);
  redirect(withMsg('/jwnet', 'ok', '入力済にしました'));
}

export async function cancelJwnetMessage(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  await db.delete(jwnetMessages).where(and(eq(jwnetMessages.id, id), eq(jwnetMessages.status, 'pending')));
  await audit(user.id, 'cancel', 'jwnet_message', id);
  redirect(withMsg('/jwnet', 'ok', '取り消しました'));
}

/** JWNETからダウンロードしたマニフェスト情報（CSV）を受託マニフェストとして取り込む */
export async function importJwnetCsv(fd: FormData) {
  const user = await requireUser();
  const facilityId = optInt(fd, 'facilityId');
  const file = fd.get('file');
  if (!facilityId) redirect(withMsg('/jwnet', 'error', '取り込み先の処分事業場を選んでください'));
  if (!(file instanceof File) || file.size === 0) redirect(withMsg('/jwnet', 'error', 'CSVファイルを選んでください'));
  const buf = Buffer.from(await file.arrayBuffer());
  // JWNETのCSVはShift_JISの場合がある。UTF-8として壊れていればShift_JISで読み直す
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) text = new TextDecoder('shift_jis').decode(buf);
  const { rows, errors } = readImportRows(text);
  if (errors.length) redirect(withMsg('/jwnet', 'error', errors.slice(0, 5).join(' / ')));

  const partnerCache = new Map<string, number>();
  async function partnerId(name: string, role: 'isEmitter' | 'isTransporter'): Promise<number | null> {
    if (!name) return null;
    const key = `${role}:${name}`;
    if (partnerCache.has(key)) return partnerCache.get(key)!;
    const [found] = await db.select().from(schema.partners).where(eq(schema.partners.name, name));
    let id = found?.id;
    if (found && !found[role]) await db.update(schema.partners).set({ [role]: true }).where(eq(schema.partners.id, found.id));
    if (!id) id = (await db.insert(schema.partners).values({ name, [role]: true }).returning())[0].id;
    partnerCache.set(key, id);
    return id;
  }

  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    const emitterId = (await partnerId(r.emitterName, 'isEmitter'))!;
    let emitterSiteId: number | null = null;
    if (r.siteName) {
      const [site] = await db.select().from(schema.emitterSites)
        .where(and(eq(schema.emitterSites.partnerId, emitterId), eq(schema.emitterSites.name, r.siteName)));
      emitterSiteId = site?.id ?? (await db.insert(schema.emitterSites).values({ partnerId: emitterId, name: r.siteName, address: r.siteAddress }).returning())[0].id;
    }
    const qty = r.qty ? Number(r.qty.replace(/,/g, '')) : null;
    const unit = r.unit || 't';
    const wasteType = ALL_WASTE_TYPES.find((t) => r.wasteType.includes(t.replace('【特管】', ''))) ?? r.wasteType;
    const res = await db.insert(schema.manifests).values({
      facilityId: facilityId!, medium: 'electronic', manifestNo: r.manifestNo, issueDate: r.issueDate,
      emitterId, emitterSiteId, transporterId: await partnerId(r.transporterName, 'isTransporter'),
      wasteType, wasteName: r.wasteName, special: r.wasteType.includes('特管') || r.wasteType.includes('特別管理'),
      declaredQty: Number.isFinite(qty) ? qty : null, declaredUnit: unit, packaging: r.packaging,
      receivedQtyT: null, createdBy: user.id,
    }).onConflictDoNothing().returning({ id: schema.manifests.id });
    if (res.length) created++; else skipped++;
  }
  await audit(user.id, 'import', 'manifest', '', null, { file: file.name, created, skipped });
  redirect(withMsg('/manifests', 'ok', `${created}件を取り込みました${skipped ? `（登録済み${skipped}件はスキップ）` : ''}`));
}
