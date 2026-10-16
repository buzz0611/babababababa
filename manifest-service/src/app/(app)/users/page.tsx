import { asc } from 'drizzle-orm';
import { createUser, updateUser } from '@/actions/users';
import { Flash, type SP } from '@/components/ui';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireAdmin();
  const users = await db.select().from(schema.users).orderBy(asc(schema.users.id));
  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <h1>ユーザー</h1>
        <div className="tablewrap">
          <table>
            <thead><tr><th>ログインID</th><th>氏名</th><th>権限</th><th>状態</th><th>パスワード再設定</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.loginId}</td>
                  <td><input form={`u${u.id}`} name="name" defaultValue={u.name} /></td>
                  <td>
                    <select form={`u${u.id}`} name="role" defaultValue={u.role}><option value="staff">一般</option><option value="admin">管理者</option></select>
                  </td>
                  <td><label className="row"><input form={`u${u.id}`} type="checkbox" name="active" defaultChecked={u.active} />有効</label></td>
                  <td><input form={`u${u.id}`} name="password" type="password" placeholder="変更時のみ" autoComplete="new-password" /></td>
                  <td>
                    <form id={`u${u.id}`} action={updateUser}><input type="hidden" name="id" value={u.id} /><button className="btn small">保存</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>ユーザーを追加</h2>
        <form action={createUser} className="form">
          <label><span className="req">ログインID</span><input name="loginId" required /></label>
          <label>氏名<input name="name" /></label>
          <label><span className="req">初期パスワード（8文字以上）</span><input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
          <label>権限<select name="role"><option value="staff">一般</option><option value="admin">管理者</option></select></label>
          <div><button className="btn primary">追加</button></div>
        </form>
        <p className="muted">一般：マニフェスト・二次・取引先の登録と変更。管理者：さらに自社情報・処分事業場・ユーザー管理・削除・帳簿の閉鎖。</p>
      </div>
    </>
  );
}
