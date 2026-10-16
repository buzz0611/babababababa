import { count } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { login, setupAdmin } from '@/actions/auth';
import { Flash, type SP } from '@/components/ui';
import { db, schema } from '@/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  if (await currentUser()) redirect('/');
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  const firstRun = n === 0;
  return (
    <main className="login">
      <div className="card">
        <h1>📋 マニフェスト帳簿</h1>
        <Flash sp={sp} />
        {firstRun ? (
          <>
            <p className="muted">はじめに管理者アカウントを作成してください。</p>
            <form action={setupAdmin} className="form">
              <label className="wide"><span className="req">ログインID</span><input name="loginId" required autoComplete="username" /></label>
              <label className="wide">氏名<input name="name" /></label>
              <label className="wide"><span className="req">パスワード（8文字以上）</span><input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
              <div><button className="btn primary">管理者を作成して始める</button></div>
            </form>
          </>
        ) : (
          <form action={login} className="form">
            <label className="wide">ログインID<input name="loginId" required autoComplete="username" autoFocus /></label>
            <label className="wide">パスワード<input name="password" type="password" required autoComplete="current-password" /></label>
            <div><button className="btn primary">ログイン</button></div>
          </form>
        )}
      </div>
    </main>
  );
}
