import type { ReactNode } from 'react';
import { jp } from '@/lib/domain/dates';
import { STATE_LABEL, type Task, type TaskState } from '@/lib/domain/deadlines';

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = one(sp.ok);
  const error = one(sp.error);
  return (
    <>
      {ok && <div className="flash ok" role="status">{ok}</div>}
      {error && <div className="flash error" role="alert">{error}</div>}
    </>
  );
}

const CLS: Record<TaskState, string> = { overdue: 'bad', soon: 'warn', pending: 'info', waiting: '', late_done: 'warn', done: 'ok' };

export function StateTag({ state, children }: { state: TaskState; children?: ReactNode }) {
  return <span className={`tag ${CLS[state]}`}>{children ?? STATE_LABEL[state]}</span>;
}

/** 手続きを短く表示（一覧用） */
export function TaskTags({ tasks }: { tasks: Task[] }) {
  return (
    <div className="tags">
      {tasks.map((t) => (
        <StateTag key={t.key} state={t.state}>
          {short(t)}
        </StateTag>
      ))}
    </div>
  );
}

export function short(t: Task) {
  const name = t.label.replace(/（.*?）/g, '');
  if (t.state === 'overdue') return `${name} ${-t.left!}日超過`;
  if (t.state === 'soon' || t.state === 'pending') return `${name} 〜${jp(t.due).slice(5)}`;
  if (t.state === 'waiting') return `${name} 待ち`;
  if (t.state === 'late_done') return `${name} 遅延済`;
  return `${name} 済`;
}

export const D = ({ d }: { d: string | null | undefined }) => <>{jp(d) || '—'}</>;
export const Q = ({ q, unit = 't' }: { q: number | null | undefined; unit?: string }) => (
  <>{q == null ? '—' : `${q.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} ${unit}`}</>
);
