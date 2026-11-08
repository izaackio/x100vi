import { requireOwner } from '@/lib/auth';
import { Shell, PageHeading } from '@/components/shell';
import { WatchForm } from '@/components/forms';
export default async function NewWatch() {
  await requireOwner();
  return (
    <Shell>
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="Set your sights."
        description="One camera, a clear budget, and a little patience."
      />
      <section className="form-card">
        <WatchForm />
      </section>
    </Shell>
  );
}
