import Link from 'next/link';
import { notFound } from 'next/navigation';
import { completeSecondaryTask, deleteSecondary, queueSecondaryRegistration } from '@/actions/secondary';
import { ConfirmButton } from '@/components/ConfirmButton';
import { TaskPanel } from '@/components/TaskPanel';
import { D, Flash, Q, StateTag, type SP } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { linksForSecondary, loadSecondaries } from '@/lib/data';
import { MEDIUM_LABEL } from '@/lib/domain/constants';
import { SecondaryForm } from '../SecondaryForm';

export default async function SecondaryDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const [s] = await loadSecondaries({ ids: [Number(id) || 0] });
  if (!s) notFound();
  const links = await linksForSecondary(s.id);
  return (
    <>
      <Flash sp={sp} />
      <div className="card">
        <div className="row">
          <h1 style={{ margin: 0 }}>二次・{MEDIUM_LABEL[s.medium]}マニフェスト {s.manifestNo}</h1>
          <StateTag state={s.state} />
          <span className="spacer" />
          <Link className="btn" href="/secondary">一覧へ</Link>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {s.wasteType} <Q q={s.qtyT} /> ／ 交付 <D d={s.issueDate} /> ／ {s.disposerName} {s.destAddress} ／ 紐付く受託 {links.length} 件
        </p>
      </div>
      <div className="card">
        <h2>返送票・終了報告の確認</h2>
        <TaskPanel
          tasks={s.tasks}
          id={s.id}
          action={completeSecondaryTask}
          extra={(t) => (t.key === 'register' && !t.doneDate ? (
            <form action={queueSecondaryRegistration}>
              <input type="hidden" name="id" value={s.id} />
              <button className="btn small primary">JWNET送信キューへ</button>
            </form>
          ) : null)}
        />
        <p className="muted">E票（最終処分終了）は、最終処分の場所を下のフォームに入れてから完了登録してください。</p>
      </div>
      <div className="card">
        <h2>編集</h2>
        <SecondaryForm s={s} links={links} />
      </div>
      {user.role === 'admin' && (
        <form action={deleteSecondary}>
          <input type="hidden" name="id" value={s.id} />
          <ConfirmButton message="この二次マニフェストを削除しますか？">削除</ConfirmButton>
        </form>
      )}
    </>
  );
}
