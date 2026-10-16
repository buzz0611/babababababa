import Link from 'next/link';
import { logout } from '@/actions/auth';
import { NavLinks } from '@/components/NavLinks';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = [
    { href: '/', label: 'ダッシュボード' },
    { href: '/manifests', label: '受託マニフェスト' },
    { href: '/secondary', label: '二次マニフェスト' },
    { href: '/ledger', label: '帳簿' },
    { href: '/jwnet', label: 'JWNET連携' },
    { href: '/masters', label: 'マスタ' },
    ...(user.role === 'admin' ? [{ href: '/users', label: 'ユーザー' }, { href: '/audit', label: '操作履歴' }] : []),
  ];
  return (
    <>
      <header className="top">
        <div className="bar">
          <Link href="/" className="brand">📋 マニフェスト帳簿</Link>
          <NavLinks links={links} />
          <div className="who">
            <Link href="/account">{user.name}</Link>
            <form action={logout}><button className="btn small">ログアウト</button></form>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
