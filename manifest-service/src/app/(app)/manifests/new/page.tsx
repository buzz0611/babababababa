import { Flash, type SP } from '@/components/ui';
import { ManifestForm } from '../ManifestForm';

export default async function NewManifest({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="card">
      <h1>受託マニフェスト登録</h1>
      <Flash sp={sp} />
      <ManifestForm />
    </div>
  );
}
