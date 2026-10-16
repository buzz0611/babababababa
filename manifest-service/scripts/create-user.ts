/**
 * ユーザーを作成する（パスワードを忘れた管理者の復旧などに使う）
 *   npm run user:create -- <ログインID> <パスワード> [admin|staff] [氏名]
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
import * as schema from '../src/db/schema';

const [loginId, password, role = 'admin', name = loginId] = process.argv.slice(2);
if (!loginId || !password || password.length < 8) {
  console.error('使い方: npm run user:create -- <ログインID> <パスワード(8文字以上)> [admin|staff] [氏名]');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const salt = randomBytes(16);
const passwordHash = `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 64).toString('base64')}`;
const values = { loginId, name, role: role === 'staff' ? 'staff' as const : 'admin' as const, passwordHash, active: true };
const [existing] = await db.select().from(schema.users).where(eq(schema.users.loginId, loginId));
if (existing) await db.update(schema.users).set(values).where(eq(schema.users.id, existing.id));
else await db.insert(schema.users).values(values);
await pool.end();
console.log(`${existing ? '更新' : '作成'}しました: ${loginId}`);
