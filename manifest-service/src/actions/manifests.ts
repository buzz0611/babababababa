'use server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { audit } from '@/lib/audit';
import { requireAdmin, requireUser } from '@/lib/auth';
import { findClosedYear } from '@/lib/data';
import { todayJst } from '@/lib/domain/dates';
import { bool, optDate, optInt, optNum, str, withMsg } from '@/lib/form';
import { buildManifestPayload } from '@/lib/jwnet/build';
import { validatePayload } from '@/lib/jwnet/payload';

const { manifests } = schema;

const isUniqueViolation = (e: unknown) => (e as { code?: string; cause?: { code?: string } })?.code === '23505'
  || (e as { cause?: { code?: string } })?.cause?.code === '23505';

function readManifest(fd: FormData) {
  const medium = str(fd, 'medium') === 'electronic' ? 'electronic' as const : 'paper' as const;
  return {
    facilityId: optInt(fd, 'facilityId'),
    medium,
    manifestNo: str(fd, 'manifestNo'),
    issueDate: optDate(fd, 'issueDate'),
    emitterId: optInt(fd, 'emitterId'),
    emitterSiteId: optInt(fd, 'emitterSiteId'),
    transporterId: optInt(fd, 'transporterId'),
    wasteType: str(fd, 'wasteType'),
    wasteName: str(fd, 'wasteName'),
    special: bool(fd, 'special') || str(fd, 'wasteType').startsWith('【特管】'),
    declaredQty: optNum(fd, 'declaredQty'),
    declaredUnit: str(fd, 'declaredUnit') || 't',
    packaging: str(fd, 'packaging'),
    receivedDate: optDate(fd, 'receivedDate'),
    receivedQtyT: optNum(fd, 'receivedQtyT'),
    disposalMethod: str(fd, 'disposalMethod'),
    disposalEndDate: optDate(fd, 'disposalEndDate'),
    disposedQtyT: optNum(fd, 'disposedQtyT'),
    c2SentDate: optDate(fd, 'c2SentDate'),
    dSentDate: optDate(fd, 'dSentDate'),
    disposalReportedDate: optDate(fd, 'disposalReportedDate'),
    finalNoticeReceivedDate: optDate(fd, 'finalNoticeReceivedDate'),
    finalDisposalDate: optDate(fd, 'finalDisposalDate'),
    finalDisposalPlace: str(fd, 'finalDisposalPlace'),
    eSentDate: optDate(fd, 'eSentDate'),
    finalReportedDate: optDate(fd, 'finalReportedDate'),
    note: str(fd, 'note'),
  };
}

function validate(v: ReturnType<typeof readManifest>): string | null {
  if (!v.facilityId) return '処分事業場を選んでください';
  if (!v.manifestNo) return v.medium === 'paper' ? '交付番号を入力してください' : '登録番号を入力してください';
  if (!v.issueDate) return '交付年月日（引渡し日）を入力してください';
  if (!v.emitterId) return '排出事業者を選んでください';
  if (!v.wasteType) return '廃棄物の種類を選んでください';
  if (v.receivedDate && v.receivedDate < v.issueDate) return '受入日が交付日より前になっています';
  if (v.disposalEndDate && v.receivedDate && v.disposalEndDate < v.receivedDate) return '処分終了日が受入日より前になっています';
  if (v.disposalEndDate && !v.receivedDate) return '処分終了日を入れる前に受入日を入力してください';
  for (const [k, label] of [['c2SentDate', 'C2票送付日'], ['dSentDate', 'D票送付日'], ['disposalReportedDate', '処分終了報告日']] as const) {
    if (v[k] && (!v.disposalEndDate || v[k]! < v.disposalEndDate)) return `${label}は処分終了日以降の日付にしてください`;
  }
  return null;
}

export async function saveManifest(fd: FormData) {
  const user = await requireUser();
  const id = optInt(fd, 'id');
  const back = id ? `/manifests/${id}` : '/manifests/new';
  const v = readManifest(fd);
  const err = validate(v);
  if (err) redirect(withMsg(back, 'error', err));

  const [facility] = await db.select().from(schema.facilities).where(eq(schema.facilities.id, v.facilityId!));
  // 自社が最終処分場なら処分終了＝最終処分終了
  if (facility?.isFinalDisposal && v.disposalEndDate) {
    v.finalDisposalDate ??= v.disposalEndDate;
    if (!v.finalDisposalPlace) v.finalDisposalPlace = `${facility.name} ${facility.address}`.trim();
  }

  const before = id ? (await db.select().from(manifests).where(eq(manifests.id, id)))[0] : undefined;
  if (id && !before) redirect('/manifests');
  const closed = await findClosedYear(v.facilityId!, [before?.receivedDate, before?.disposalEndDate, v.receivedDate, v.disposalEndDate]);
  if (closed != null) redirect(withMsg(back, 'error', `${closed}年度の帳簿は閉鎖済みのため変更できません（管理者が帳簿画面で再開できます）`));

  const values = { ...v, facilityId: v.facilityId!, issueDate: v.issueDate!, emitterId: v.emitterId!, updatedAt: new Date() };
  let savedId = id;
  try {
    if (id) {
      await db.update(manifests).set(values).where(eq(manifests.id, id));
      await audit(user.id, 'update', 'manifest', id, before, values);
    } else {
      const [row] = await db.insert(manifests).values({ ...values, createdBy: user.id }).returning({ id: manifests.id });
      savedId = row.id;
      await audit(user.id, 'create', 'manifest', row.id, null, values);
    }
  } catch (e) {
    if (isUniqueViolation(e)) redirect(withMsg(back, 'error', `番号「${v.manifestNo}」は既に登録されています`));
    throw e;
  }
  redirect(withMsg(`/manifests/${savedId}`, 'ok', '保存しました'));
}

const TASK_FIELD = {
  c2: 'c2SentDate', d: 'dSentDate', e: 'eSentDate', disposal_report: 'disposalReportedDate', final_report: 'finalReportedDate',
} as const;

/** 手続きを「今日（または指定日）完了」にする */
export async function completeManifestTask(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  const key = str(fd, 'key') as keyof typeof TASK_FIELD;
  const field = TASK_FIELD[key];
  const date = optDate(fd, 'date') ?? todayJst();
  const back = str(fd, 'back') || `/manifests/${id}`;
  if (!field) redirect(back);
  const [m] = await db.select().from(manifests).where(eq(manifests.id, id));
  if (!m) redirect('/manifests');
  if (await findClosedYear(m.facilityId, [m.receivedDate, m.disposalEndDate]) != null) {
    redirect(withMsg(back, 'error', '閉鎖済みの帳簿年度のため変更できません'));
  }
  await db.update(manifests).set({ [field]: date, updatedAt: new Date() }).where(eq(manifests.id, id));
  await audit(user.id, 'complete_task', 'manifest', id, { [field]: m[field] }, { [field]: date });
  redirect(withMsg(back, 'ok', '完了にしました'));
}

export async function deleteManifest(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(str(fd, 'id'));
  const [m] = await db.select().from(manifests).where(eq(manifests.id, id));
  if (!m) redirect('/manifests');
  const links = await db.select().from(schema.secondaryLinks).where(eq(schema.secondaryLinks.manifestId, id));
  if (links.length) redirect(withMsg(`/manifests/${id}`, 'error', '二次マニフェストに紐付いているため削除できません'));
  if (await findClosedYear(m.facilityId, [m.receivedDate, m.disposalEndDate]) != null) {
    redirect(withMsg(`/manifests/${id}`, 'error', '閉鎖済みの帳簿年度のため削除できません'));
  }
  await db.delete(schema.jwnetMessages).where(eq(schema.jwnetMessages.manifestId, id));
  await db.delete(manifests).where(eq(manifests.id, id));
  await audit(user.id, 'delete', 'manifest', id, m, null);
  redirect(withMsg('/manifests', 'ok', `${m.manifestNo} を削除しました`));
}

/** JWNET送信キューに報告を積む */
export async function queueManifestReport(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  const kind = str(fd, 'kind') === 'final_disposal_end' ? 'final_disposal_end' as const : 'disposal_end' as const;
  let payload;
  try {
    payload = await buildManifestPayload(id, kind);
  } catch (e) {
    redirect(withMsg(`/manifests/${id}`, 'error', (e as Error).message));
  }
  const errors = validatePayload(payload);
  if (errors.length) redirect(withMsg(`/manifests/${id}`, 'error', errors.join(' / ')));
  const [msg] = await db.insert(schema.jwnetMessages).values({ kind, manifestId: id, payload, createdBy: user.id }).returning();
  await audit(user.id, 'queue', 'jwnet_message', msg.id, null, payload);
  redirect(withMsg('/jwnet', 'ok', '送信キューに追加しました'));
}
