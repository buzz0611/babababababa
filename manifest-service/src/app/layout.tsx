import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'マニフェスト帳簿（処分業者向け）',
  description: '産業廃棄物処分業者向けのマニフェスト・帳簿管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
