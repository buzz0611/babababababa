import { describe, expect, it } from 'vitest';
import { primaryTasks, secondaryTasks, worstState, type PrimaryLike, type SecondaryLike } from '@/lib/domain/deadlines';

const base: PrimaryLike = {
  medium: 'paper', transporterId: 1, disposalEndDate: null, c2SentDate: null, dSentDate: null,
  disposalReportedDate: null, finalNoticeReceivedDate: null, eSentDate: null, finalReportedDate: null,
};

describe('受託マニフェスト（紙）', () => {
  it('処分終了前は起点待ち', () => {
    const t = primaryTasks(base, '2026-10-16');
    expect(t.map((x) => x.state)).toEqual(['waiting', 'waiting', 'waiting']);
  });
  it('処分終了日から10日以内にC2・D票', () => {
    const t = primaryTasks({ ...base, disposalEndDate: '2026-10-01' }, '2026-10-09');
    expect(t[0]).toMatchObject({ key: 'c2', due: '2026-10-11', state: 'soon', left: 2 });
    expect(t[1]).toMatchObject({ key: 'd', due: '2026-10-11' });
    expect(t[2]).toMatchObject({ key: 'e', state: 'waiting', waitingFor: '二次委託先の最終処分終了待ち' });
  });
  it('運搬業者なし（自己搬入）ならC2票は不要', () => {
    expect(primaryTasks({ ...base, transporterId: null }, '2026-10-16').map((x) => x.key)).toEqual(['d', 'e']);
  });
  it('期限超過と遅延完了', () => {
    const t = primaryTasks({ ...base, disposalEndDate: '2026-09-01', dSentDate: '2026-09-20' }, '2026-10-16');
    expect(t[0].state).toBe('overdue');
    expect(t[1].state).toBe('late_done');
    expect(worstState(t)).toBe('overdue');
  });
  it('最終処分の報告を受けた日から10日以内にE票', () => {
    const t = primaryTasks({ ...base, disposalEndDate: '2026-09-01', finalNoticeReceivedDate: '2026-10-10' }, '2026-10-16');
    expect(t[2]).toMatchObject({ due: '2026-10-20', state: 'pending' });
  });
  it('自社が最終処分場なら処分終了日が起点', () => {
    const t = primaryTasks({ ...base, disposalEndDate: '2026-10-10' }, '2026-10-16', true);
    expect(t[2]).toMatchObject({ due: '2026-10-20' });
  });
});

describe('受託マニフェスト（電子）', () => {
  it('処分終了報告は3営業日以内', () => {
    const t = primaryTasks({ ...base, medium: 'electronic', disposalEndDate: '2026-10-16' }, '2026-10-16');
    expect(t[0]).toMatchObject({ key: 'disposal_report', due: '2026-10-21', state: 'pending' });
    expect(t[1].state).toBe('waiting');
  });
});

describe('二次マニフェスト', () => {
  const s: SecondaryLike = { medium: 'paper', issueDate: '2026-06-01', registeredDate: null, special: false, b2Date: '2026-06-05', dDate: null, eDate: null };
  it('90日・180日の確認期限と措置内容等報告書', () => {
    const t = secondaryTasks(s, '2026-09-15');
    expect(t[0].state).toBe('done');
    expect(t[1]).toMatchObject({ key: 'd', due: '2026-08-30', state: 'overdue', authorityReportDue: '2026-09-29' });
    expect(t[2]).toMatchObject({ key: 'e', due: '2026-11-28', state: 'pending' });
  });
  it('特管は60日', () => {
    expect(secondaryTasks({ ...s, special: true }, '2026-06-02')[1].due).toBe('2026-07-31');
  });
  it('電子は3営業日以内に登録', () => {
    const t = secondaryTasks({ ...s, medium: 'electronic', issueDate: '2026-10-16' }, '2026-10-16');
    expect(t[0]).toMatchObject({ key: 'register', due: '2026-10-21' });
    expect(t.map((x) => x.label)).toContain('処分終了報告');
  });
});
