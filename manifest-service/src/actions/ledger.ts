'use server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { audit } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth';
import { str, withMsg } from '@/lib/form';

/** 帳簿を1年ごとに閉鎖する（閉鎖後は該当年度のデータを変更不可にする） */
export async function closeLedgerYear(fd: FormData) {
  const user = await requireAdmin();
  const facilityId = Number(str(fd, 'facilityId'));
  const fiscalYear = Number(str(fd, 'fiscalYear'));
  const back = str(fd, 'back') || '/ledger';
  await db.insert(schema.ledgerClosures).values({ facilityId, fiscalYear, closedBy: user.id }).onConflictDoNothing();
  await audit(user.id, 'close', 'ledger', `${facilityId}:${fiscalYear}`);
  redirect(withMsg(back, 'ok', `${fiscalYear}年度の帳簿を閉鎖しました`));
}

export async function reopenLedgerYear(fd: FormData) {
  const user = await requireAdmin();
  const facilityId = Number(str(fd, 'facilityId'));
  const fiscalYear = Number(str(fd, 'fiscalYear'));
  const back = str(fd, 'back') || '/ledger';
  if (!str(fd, 'reason')) redirect(withMsg(back, 'error', '再開する理由を入力してください'));
  await db.delete(schema.ledgerClosures).where(and(eq(schema.ledgerClosures.facilityId, facilityId), eq(schema.ledgerClosures.fiscalYear, fiscalYear)));
  await audit(user.id, 'reopen', 'ledger', `${facilityId}:${fiscalYear}`, null, { reason: str(fd, 'reason') });
  redirect(withMsg(back, 'ok', `${fiscalYear}年度の帳簿を再開しました`));
}
