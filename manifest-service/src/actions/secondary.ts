'use server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { audit } from '@/lib/audit';
import { requireAdmin, requireUser } from '@/lib/auth';
import { findClosedYear } from '@/lib/data';
import { todayJst } from '@/lib/domain/dates';
import { bool, optDate, optInt, optNum, str, withMsg } from '@/lib/form';
import { checkManifestNo, normalizeManifestNo } from '@/lib/domain/manifest-no';
import { buildSecondaryPayload } from '@/lib/jwnet/build';
import { validatePayload } from '@/lib/jwnet/payload';

const { secondaryManifests: sec, secondaryLinks, manifests } = schema;

function readSecondary(fd: FormData) {
  return {
    facilityId: optInt(fd, 'facilityId'),
    medium: str(fd, 'medium') === 'electronic' ? 'electronic' as const : 'paper' as const,
    manifestNo: normalizeManifestNo(str(fd, 'manifestNo')),
    issueDate: optDate(fd, 'issueDate'),
    registeredDate: optDate(fd, 'registeredDate'),
    wasteType: str(fd, 'wasteType'),
    wasteName: str(fd, 'wasteName'),
    special: bool(fd, 'special') || str(fd, 'wasteType').startsWith('【特管】'),
    qtyT: optNum(fd, 'qtyT'),
    transporterId: optInt(fd, 'transporterId'),
    disposerId: optInt(fd, 'disposerId'),
    destAddress: str(fd, 'destAddress'),
    disposalMethod: str(fd, 'disposalMethod'),
    isFinal: bool(fd, 'isFinal'),
    b2Date: optDate(fd, 'b2Date'),
    dDate: optDate(fd, 'dDate'),
    eDate: optDate(fd, 'eDate'),
    finalDisposalDate: optDate(fd, 'finalDisposalDate'),
    finalDisposalPlace: str(fd, 'finalDisposalPlace'),
    reportedToAuthority: optDate(fd, 'reportedToAuthority'),
    note: str(fd, 'note'),
  };
}

/** フォームの link_<id> / alloc_<id> から紐付けを読む */
function readLinks(fd: FormData) {
  const links: { manifestId: number; allocatedQtyT: number | null }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^link_(\d+)$/.exec(k);
    if (m && v === 'on') links.push({ manifestId: Number(m[1]), allocatedQtyT: optNum(fd, `alloc_${m[1]}`) });
  }
  return links;
}

/**
 * 二次の最終処分終了（E票受領 / 最終処分終了報告の受信）を、紐付く一次マニフェストへ反映する。
 * 一次側では「最終処分終了の報告を受けた日」から10日（電子は3営業日）以内に E票送付／最終処分終了報告が必要になる。
 */
async function propagateFinal(secondaryId: number, userId: number) {
  const [s] = await db.select().from(sec).where(eq(sec.id, secondaryId));
  if (!s?.eDate) return 0;
  const links = await db.select().from(secondaryLinks).where(eq(secondaryLinks.secondaryId, secondaryId));
  if (!links.length) return 0;
  const updated = await db.update(manifests).set({
    finalNoticeReceivedDate: s.eDate,
    finalDisposalDate: s.finalDisposalDate ?? s.eDate,
    finalDisposalPlace: s.finalDisposalPlace,
    updatedAt: new Date(),
  }).where(and(inArray(manifests.id, links.map((l) => l.manifestId)), isNull(manifests.finalNoticeReceivedDate)))
    .returning({ id: manifests.id });
  for (const u of updated) {
    await audit(userId, 'propagate_final', 'manifest', u.id, null, { fromSecondary: secondaryId, finalNoticeReceivedDate: s.eDate });
  }
  return updated.length;
}

export async function saveSecondary(fd: FormData) {
  const user = await requireUser();
  const id = optInt(fd, 'id');
  const back = id ? `/secondary/${id}` : '/secondary/new';
  const v = readSecondary(fd);
  const links = readLinks(fd);
  const err = !v.facilityId ? '処分事業場を選んでください'
    : !v.manifestNo ? '交付番号（登録番号）を入力してください'
      : checkManifestNo(v.manifestNo, v.medium) ? checkManifestNo(v.manifestNo, v.medium)!
      : !v.issueDate ? '交付日（引渡し日）を入力してください'
        : !v.wasteType ? '処分後物の種類を選んでください'
          : v.qtyT == null ? '持出量を入力してください'
            : !v.disposerId ? '委託先処分業者を選んでください'
              : v.eDate && !v.finalDisposalPlace ? '最終処分終了を受領したら最終処分の場所を入力してください'
                : null;
  if (err) redirect(withMsg(back, 'error', err));
  if (await findClosedYear(v.facilityId!, [v.issueDate]) != null) redirect(withMsg(back, 'error', '閉鎖済みの帳簿年度のため変更できません'));

  const values = { ...v, facilityId: v.facilityId!, issueDate: v.issueDate!, qtyT: v.qtyT!, disposerId: v.disposerId!, updatedAt: new Date() };
  const before = id ? (await db.select().from(sec).where(eq(sec.id, id)))[0] : undefined;
  let savedId = id;
  try {
    await db.transaction(async (tx) => {
      if (id) {
        await tx.update(sec).set(values).where(eq(sec.id, id));
      } else {
        const [row] = await tx.insert(sec).values({ ...values, createdBy: user.id }).returning({ id: sec.id });
        savedId = row.id;
      }
      await tx.delete(secondaryLinks).where(eq(secondaryLinks.secondaryId, savedId!));
      if (links.length) await tx.insert(secondaryLinks).values(links.map((l) => ({ ...l, secondaryId: savedId! })));
    });
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === '23505') redirect(withMsg(back, 'error', `番号「${v.manifestNo}」は既に登録されています`));
    throw e;
  }
  await audit(user.id, id ? 'update' : 'create', 'secondary_manifest', savedId!, before ?? null, { ...values, links });
  const n = await propagateFinal(savedId!, user.id);
  redirect(withMsg(`/secondary/${savedId}`, 'ok', n ? `保存しました。一次マニフェスト${n}件に最終処分終了を反映しました` : '保存しました'));
}

const TASK_FIELD = { register: 'registeredDate', b2: 'b2Date', d: 'dDate', e: 'eDate' } as const;

export async function completeSecondaryTask(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  const field = TASK_FIELD[str(fd, 'key') as keyof typeof TASK_FIELD];
  const back = str(fd, 'back') || `/secondary/${id}`;
  if (!field) redirect(back);
  const [s] = await db.select().from(sec).where(eq(sec.id, id));
  if (!s) redirect('/secondary');
  if (field === 'eDate' && !s.finalDisposalPlace) {
    redirect(withMsg(`/secondary/${id}`, 'error', '最終処分の場所を入力してから保存してください（フォームのE票受領日を使ってください）'));
  }
  const date = optDate(fd, 'date') ?? todayJst();
  await db.update(sec).set({ [field]: date, updatedAt: new Date() }).where(eq(sec.id, id));
  await audit(user.id, 'complete_task', 'secondary_manifest', id, { [field]: s[field] }, { [field]: date });
  const n = field === 'eDate' ? await propagateFinal(id, user.id) : 0;
  redirect(withMsg(back, 'ok', n ? `完了にしました。一次マニフェスト${n}件に反映しました` : '完了にしました'));
}

export async function deleteSecondary(fd: FormData) {
  const user = await requireAdmin();
  const id = Number(str(fd, 'id'));
  const [s] = await db.select().from(sec).where(eq(sec.id, id));
  if (!s) redirect('/secondary');
  if (await findClosedYear(s.facilityId, [s.issueDate]) != null) redirect(withMsg(`/secondary/${id}`, 'error', '閉鎖済みの帳簿年度のため削除できません'));
  await db.delete(schema.jwnetMessages).where(eq(schema.jwnetMessages.secondaryId, id));
  await db.delete(sec).where(eq(sec.id, id));
  await audit(user.id, 'delete', 'secondary_manifest', id, s, null);
  redirect(withMsg('/secondary', 'ok', `${s.manifestNo} を削除しました`));
}

export async function queueSecondaryRegistration(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, 'id'));
  const payload = await buildSecondaryPayload(id);
  const errors = validatePayload(payload);
  if (errors.length) redirect(withMsg(`/secondary/${id}`, 'error', errors.join(' / ')));
  const [msg] = await db.insert(schema.jwnetMessages).values({ kind: 'register_secondary', secondaryId: id, payload, createdBy: user.id }).returning();
  await audit(user.id, 'queue', 'jwnet_message', msg.id, null, payload);
  redirect(withMsg('/jwnet', 'ok', '送信キューに追加しました'));
}
