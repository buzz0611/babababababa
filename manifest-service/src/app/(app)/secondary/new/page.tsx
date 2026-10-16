import { Flash, one, type SP } from '@/components/ui';
import { SecondaryForm } from '../SecondaryForm';

export default async function NewSecondary({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="card">
      <h1>二次マニフェスト登録</h1>
      <Flash sp={sp} />
      <SecondaryForm preselect={Number(one(sp.from)) || undefined} />
    </div>
  );
}
