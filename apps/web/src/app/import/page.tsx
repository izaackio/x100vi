import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth';
import { getDashboard } from '@tracker/db';
import { Shell, PageHeading } from '@/components/shell';
import { ImportForm } from '@/components/forms';
export default async function Import({
  searchParams,
}: {
  searchParams: Promise<{ watch?: string; listing?: string }>;
}) {
  const owner = await requireOwner();
  const { watches, listings } = await getDashboard(owner);
  const params = await searchParams;
  const listing = listings.find((l) => l.id === params.listing);
  if (params.listing && !listing) notFound();
  return (
    <Shell>
      <PageHeading
        eyebrow="FOUND SOMETHING PROMISING?"
        title={listing ? 'A closer look.' : 'Bring your find into focus.'}
        description="Add the listing details. We’ll check the model, the offer, and the full cost."
      />
      <section className="form-card">
        {watches.length ? (
          <ImportForm watches={watches} listing={listing} watchId={params.watch} />
        ) : (
          <div className="empty-state">
            <h2>Create a watch first.</h2>
            <p>Your budget and delivery preferences give each listing context.</p>
            <Link href="/watches/new" className="button">
              Create a watch →
            </Link>
          </div>
        )}
      </section>
    </Shell>
  );
}
