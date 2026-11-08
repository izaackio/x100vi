import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { getDashboard } from '@tracker/db';
import { Shell, PageHeading } from '@/components/shell';
import { WatchForm } from '@/components/forms';
export default async function EditWatch({ params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  const { id } = await params;
  const { watches } = await getDashboard(owner);
  const watch = watches.find((w) => w.id === id);
  if (!watch) notFound();
  return (
    <Shell>
      <PageHeading
        eyebrow="REFINE THE PURSUIT"
        title="Your watch, your rules."
        description="Keep the goal clear. Every cost counts toward the budget."
      />
      <section className="form-card">
        <WatchForm watch={watch} />
      </section>
    </Shell>
  );
}
