import { changeOwnPassword } from '@/actions/auth';
import { Flash, type SP } from '@/components/ui';
import { requireUser } from '@/lib/auth';

export default async function Account({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser();
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h1>アカウント</h1>
      <Flash sp={sp} />
      <p>{user.name}（{user.loginId}・{user.role === 'admin' ? '管理者' : '一般'}）</p>
      <form action={changeOwnPassword} className="form">
        <label className="wide">現在のパスワード<input name="current" type="password" required autoComplete="current-password" /></label>
        <label className="wide">新しいパスワード（8文字以上）<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
        <div><button className="btn primary">変更</button></div>
      </form>
    </div>
  );
}
