'use client';
import type { ReactNode } from 'react';

/** 送信前に確認ダイアログを出すボタン */
export function ConfirmButton({ message, children, className = 'btn danger' }: { message: string; children: ReactNode; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
