'use server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { audit } from '@/lib/audit';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { bool, str, withMsg } from '@/lib/form';

export async function createUser(fd: FormData) {
  const admin = await requireAdmin();
  const pw = str(fd, 'password');
  const loginId = str(fd, 'loginId');
  if (!loginId || pw.length < 8) redirect(withMsg('/users', 'error', 'ログインIDと8文字以上のパスワードを入力してください'));
  const [dup] = await db.select().from(schema.users).where(eq(schema.users.loginId, loginId));
  if (dup) redirect(withMsg('/users', 'error', 'そのログインIDは使われています'));
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'staff';
  const [u] = await db.insert(schema.users).values({ loginId, name: str(fd, 'name') || loginId, role, passwordHash: await hashPassword(pw) }).returning();
  await audit(admin.id, 'create', 'user', u.id, null, { loginId, role });
  redirect(withMsg('/users', 'ok', `${u.name} を追加しました`));
}

export async function updateUser(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(str(fd, 'id'));
  const [before] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!before) redirect('/users');
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'staff';
  const active = bool(fd, 'active');
  if (id === admin.id && (role !== 'admin' || !active)) redirect(withMsg('/users', 'error', '自分自身の権限は外せません'));
  const pw = str(fd, 'password');
  if (pw && pw.length < 8) redirect(withMsg('/users', 'error', 'パスワードは8文字以上にしてください'));
  await db.update(schema.users).set({
    name: str(fd, 'name') || before.name, role, active, updatedAt: new Date(),
    ...(pw ? { passwordHash: await hashPassword(pw) } : {}),
  }).where(eq(schema.users.id, id));
  if (!active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  await audit(admin.id, 'update', 'user', id, { role: before.role, active: before.active }, { role, active, passwordReset: !!pw });
  redirect(withMsg('/users', 'ok', '更新しました'));
}
