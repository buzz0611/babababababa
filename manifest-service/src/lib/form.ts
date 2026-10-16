/** FormData から値を取り出す小さなヘルパー（空文字は null） */
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const optDate = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
export const optNum = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(/,/g, '');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const optInt = (fd: FormData, k: string) => {
  const n = optNum(fd, k);
  return n == null ? null : Math.trunc(n);
};
export const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';

/** 画面にメッセージを出すためのクエリ */
export const withMsg = (path: string, kind: 'ok' | 'error', msg: string) =>
  `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`;
