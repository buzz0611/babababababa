import type { ReactNode } from 'react';
import { jp, todayJst } from '@/lib/domain/dates';
import type { Task } from '@/lib/domain/deadlines';
import { D, StateTag } from './ui';

/** 手続きの一覧と「完了登録」フォーム */
export function TaskPanel({ tasks, id, action, extra }: {
  tasks: Task[];
  id: number;
  action: (fd: FormData) => Promise<void>;
  extra?: (t: Task) => ReactNode;
}) {
  return (
    <ul className="tasks">
      {tasks.map((t) => (
        <li key={t.key}>
          <span className="label">{t.label}</span>
          <StateTag state={t.state} />
          <span className="muted">
            {t.due ? <>期限 <D d={t.due} />{t.left != null && !t.doneDate && (t.left < 0 ? `（${-t.left}日超過）` : `（あと${t.left}日）`)}</> : t.waitingFor}
            {t.doneDate && <>　完了 {jp(t.doneDate)}</>}
            {t.authorityReportDue && <>　<span className="tag bad">措置内容等報告書 <D d={t.authorityReportDue} />まで</span></>}
          </span>
          <span className="spacer" />
          {!t.doneDate && t.due && (
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="key" value={t.key} />
              <input type="date" name="date" defaultValue={todayJst()} aria-label={`${t.label}の完了日`} />
              <button className="btn small">完了登録</button>
            </form>
          )}
          {extra?.(t)}
        </li>
      ))}
    </ul>
  );
}
