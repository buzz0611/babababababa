import { addBusinessDays, addDays, diffDays, type DateStr } from './dates';
import type { Medium } from './constants';

/**
 * 処分業者として必要な手続きの期限を計算する。
 *
 * 受託（一次マニフェスト）
 *   紙  : 処分終了日から10日以内に C2票（運搬業者へ）・D票（排出事業者へ）を送付
 *         最終処分終了の報告を受けた日から10日以内に E票を送付
 *   電子: 処分終了日から3日以内に処分終了報告（土日祝・年末年始を除く）
 *         最終処分終了の報告を受けた日から3日以内に最終処分終了報告
 *   自社で最終処分（埋立）した場合は、処分終了日を最終処分終了日として扱う。
 *
 * 委託（二次マニフェスト）＝自社が排出事業者の立場
 *   電子: 引渡しから3日以内に登録
 *   紙・電子とも: 交付日から90日（特管60日）以内に運搬・処分終了、180日以内に最終処分終了の確認。
 *   期限内に確認できなければ、期限経過後30日以内に措置内容等報告書を提出。
 */

export type TaskState = 'done' | 'late_done' | 'overdue' | 'soon' | 'pending' | 'waiting';

export interface Task {
  key: string;
  label: string;
  /** 期限（起点が未確定なら null） */
  due: DateStr | null;
  doneDate: DateStr | null;
  state: TaskState;
  /** 期限までの残り日数（マイナスは超過） */
  left: number | null;
  /** 措置内容等報告書の提出期限（二次の超過時のみ） */
  authorityReportDue?: DateStr;
  /** 起点が未確定のときの説明 */
  waitingFor?: string;
}

function makeTask(
  key: string, label: string, due: DateStr | null, doneDate: DateStr | null | undefined,
  today: DateStr, soonDays: number, waitingFor?: string,
): Task {
  const done = doneDate ?? null;
  if (done) {
    return { key, label, due, doneDate: done, state: due && done > due ? 'late_done' : 'done', left: null };
  }
  if (!due) return { key, label, due: null, doneDate: null, state: 'waiting', left: null, waitingFor };
  const left = diffDays(today, due);
  const state: TaskState = left < 0 ? 'overdue' : left <= soonDays ? 'soon' : 'pending';
  return { key, label, due, doneDate: null, state, left };
}

export interface PrimaryLike {
  medium: Medium;
  transporterId: number | null;
  disposalEndDate: DateStr | null;
  c2SentDate: DateStr | null;
  dSentDate: DateStr | null;
  disposalReportedDate: DateStr | null;
  finalNoticeReceivedDate: DateStr | null;
  eSentDate: DateStr | null;
  finalReportedDate: DateStr | null;
}

/** 受託マニフェストの手続き。isFinalFacility は自社が最終処分（埋立）したか */
export function primaryTasks(m: PrimaryLike, today: DateStr, isFinalFacility = false): Task[] {
  const end = m.disposalEndDate;
  const finalStart = isFinalFacility ? end : m.finalNoticeReceivedDate;
  const finalWaiting = isFinalFacility ? '処分終了の登録待ち' : (end ? '二次委託先の最終処分終了待ち' : '処分終了の登録待ち');
  if (m.medium === 'paper') {
    const tasks: Task[] = [];
    if (m.transporterId) {
      tasks.push(makeTask('c2', 'C2票送付（運搬業者）', end ? addDays(end, 10) : null, m.c2SentDate, today, 3, '処分終了の登録待ち'));
    }
    tasks.push(makeTask('d', 'D票送付（排出事業者）', end ? addDays(end, 10) : null, m.dSentDate, today, 3, '処分終了の登録待ち'));
    tasks.push(makeTask('e', 'E票送付（排出事業者）', finalStart ? addDays(finalStart, 10) : null, m.eSentDate, today, 3, finalWaiting));
    return tasks;
  }
  return [
    makeTask('disposal_report', '処分終了報告（JWNET）', end ? addBusinessDays(end, 3) : null, m.disposalReportedDate, today, 1, '処分終了の登録待ち'),
    makeTask('final_report', '最終処分終了報告（JWNET）', finalStart ? addBusinessDays(finalStart, 3) : null, m.finalReportedDate, today, 1, finalWaiting),
  ];
}

export interface SecondaryLike {
  medium: Medium;
  issueDate: DateStr;
  registeredDate: DateStr | null;
  special: boolean;
  b2Date: DateStr | null;
  dDate: DateStr | null;
  eDate: DateStr | null;
}

/** 二次マニフェスト（自社が排出事業者）の確認期限 */
export function secondaryTasks(s: SecondaryLike, today: DateStr): Task[] {
  const span = s.special ? 60 : 90;
  const paper = s.medium === 'paper';
  const tasks: Task[] = [];
  if (!paper) {
    tasks.push(makeTask('register', 'JWNET登録', addBusinessDays(s.issueDate, 3), s.registeredDate, today, 1));
  }
  const confirm = (key: string, label: string, days: number, done: DateStr | null) => {
    const t = makeTask(key, label, addDays(s.issueDate, days), done, today, 14);
    if (t.state === 'overdue' && t.due) t.authorityReportDue = addDays(t.due, 30);
    tasks.push(t);
  };
  confirm('b2', paper ? 'B2票（運搬終了）' : '運搬終了報告', span, s.b2Date);
  confirm('d', paper ? 'D票（処分終了）' : '処分終了報告', span, s.dDate);
  confirm('e', paper ? 'E票（最終処分終了）' : '最終処分終了報告', 180, s.eDate);
  return tasks;
}

const RANK: Record<TaskState, number> = { overdue: 0, soon: 1, pending: 2, waiting: 3, late_done: 4, done: 5 };
/** 最も注意が必要な状態 */
export const worstState = (tasks: Task[]): TaskState =>
  tasks.reduce<TaskState>((w, t) => (RANK[t.state] < RANK[w] ? t.state : w), 'done');

export const STATE_LABEL: Record<TaskState, string> = {
  overdue: '期限超過', soon: '期限間近', pending: '対応待ち', waiting: '起点待ち', late_done: '遅延完了', done: '完了',
};
