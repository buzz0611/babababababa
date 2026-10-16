'use client';
export function PrintButton() {
  return <button type="button" className="btn" onClick={() => window.print()}>印刷</button>;
}
