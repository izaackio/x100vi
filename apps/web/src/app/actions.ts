'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { WatchInput, ListingInput } from '@tracker/domain';
import { saveWatch, importListing, enqueue } from '@tracker/db';
import { requireOwner } from '@/lib/auth';
export type ActionResult = { error?: string; id?: string; message?: string };
function inputError(error: unknown): ActionResult {
  if (error instanceof z.ZodError)
    return { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ') };
  if (
    error instanceof Error &&
    /not found|Enable this source|changed in another window/.test(error.message)
  )
    return { error: error.message };
  console.error('Tracker action failed. Check database availability and server configuration.');
  return { error: 'Could not save this change. Check the database and try again.' };
}
export async function saveWatchAction(form: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  try {
    const input = WatchInput.parse({
      name: form.get('name'),
      budget: form.get('budget'),
      sources: form.getAll('sources'),
      collectionLocations: form.get('collectionLocations') ?? '',
    });
    const id = form.get('id');
    const revision = form.get('revision');
    const watch = await saveWatch(owner, {
      ...input,
      id: id ? z.uuid().parse(id) : undefined,
      expectedRevision: revision ? z.coerce.number().int().positive().parse(revision) : undefined,
    });
    revalidatePath('/');
    return { id: watch.id };
  } catch (error) {
    return inputError(error);
  }
}
export async function importAction(form: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  try {
    const raw = Object.fromEntries(form.entries());
    for (const field of ['shipping', 'protection', 'otherFees', 'travel']) raw[field] ??= '';
    const data = ListingInput.parse(raw);
    const revision = form.get('revision');
    const id = await importListing(
      owner,
      data,
      revision ? z.coerce.number().int().positive().parse(revision) : undefined,
    );
    revalidatePath('/');
    return { id };
  } catch (error) {
    return inputError(error);
  }
}
export async function runAction(watchId: string, listingId?: string): Promise<ActionResult> {
  const owner = await requireOwner();
  try {
    z.uuid().parse(watchId);
    if (listingId) z.uuid().parse(listingId);
    const id = await enqueue(owner, watchId, listingId);
    revalidatePath('/');
    return {
      id,
      message:
        'Queued. Stored evidence will be re-evaluated; live checks require opening the source.',
    };
  } catch (error) {
    return inputError(error);
  }
}
