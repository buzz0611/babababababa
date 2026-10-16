'use server';
import { count, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { audit } from '@/lib/audit';
import { endSession, hashPassword, requireUser, startSession, verifyPassword } from '@/lib/auth';
import { str, withMsg } from '@/lib/form';

export async function login(fd: FormData) {
  const loginId = str(fd, 'loginId');
  const [u] = await db.select().from(schema.users).where(eq(schema.users.loginId, loginId));
  if (!u || !u.active || !(await verifyPassword(str(fd, 'password'), u.passwordHash))) {
    redirect(withMsg('/login', 'error', 'ログインIDまたはパスワードが違います'));
  }
  await startSession(u.id);
  await audit(u.id, 'login', 'user', u.id);
  redirect('/');
}

export async function logout() {
  await endSession();
  redirect('/login');
}

/** 初回のみ：最初の管理者を作成 */
export async function setupAdmin(fd: FormData) {
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n > 0) redirect('/login');
  const pw = str(fd, 'password');
  if (pw.length < 8) redirect(withMsg('/login', 'error', 'パスワードは8文字以上にしてください'));
  const [u] = await db.insert(schema.users).values({
    loginId: str(fd, 'loginId'), name: str(fd, 'name') || '管理者', passwordHash: await hashPassword(pw), role: 'admin',
  }).returning();
  await audit(u.id, 'create', 'user', u.id, null, { loginId: u.loginId, role: u.role });
  await startSession(u.id);
  redirect('/masters');
}

export async function changeOwnPassword(fd: FormData) {
  const u = await requireUser();
  if (!(await verifyPassword(str(fd, 'current'), u.passwordHash))) redirect(withMsg('/account', 'error', '現在のパスワードが違います'));
  const pw = str(fd, 'password');
  if (pw.length < 8) redirect(withMsg('/account', 'error', 'パスワードは8文字以上にしてください'));
  await db.update(schema.users).set({ passwordHash: await hashPassword(pw), updatedAt: new Date() }).where(eq(schema.users.id, u.id));
  await audit(u.id, 'change_password', 'user', u.id);
  redirect(withMsg('/account', 'ok', 'パスワードを変更しました'));
}
