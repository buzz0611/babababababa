import type { Medium } from './constants';

/** 全角数字を半角にし、空白・ハイフンを除く */
export const normalizeManifestNo = (v: string) =>
  v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[\s\-ー－‐]/g, '');

/** 紙マニフェストの交付番号のチェックデジット（先頭10桁を7で割った余り） */
export const paperCheckDigit = (first10: string) => Number(first10) % 7;

/**
 * 番号の形式チェック。問題なければ null。
 * 紙：11桁の数字で、末尾はチェックデジット。
 * 電子：数字のみ（JWNETの登録番号もチェックデジット付きだが、計算方法は将来変わりうるとJWNETが案内しているため検証しない）。
 */
export function checkManifestNo(no: string, medium: Medium): string | null {
  if (medium === 'electronic') return /^\d+$/.test(no) ? null : '登録番号は数字だけで入力してください';
  if (!/^\d{11}$/.test(no)) return `交付番号は11桁の数字で入力してください（いまは${no.length}文字です）`;
  const c = paperCheckDigit(no.slice(0, 10));
  return Number(no[10]) === c ? null : `交付番号の末尾（チェックデジット）が合いません。先頭10桁から計算すると末尾は「${c}」になります。番号を見直してください`;
}
