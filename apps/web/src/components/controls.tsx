'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { runAction } from '@/app/actions';
export function SignOut() {
  return (
    <button className="text-button" onClick={() => signOut({ callbackUrl: '/login' })}>
      Sign out →
    </button>
  );
}
export function RunButton({ watchId, listingId }: { watchId: string; listingId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  return (
    <>
      <button
        className={listingId ? 'button secondary small' : 'button secondary'}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await runAction(watchId, listingId);
            setMessage(result.error ?? result.message ?? 'Queued');
            router.refresh();
          })
        }
      >
        {pending ? 'Queuing…' : listingId ? 'Re-evaluate' : 'Search now →'}
      </button>
      {message && (
        <span className="inline-status" role="status">
          {message}
        </span>
      )}
    </>
  );
}
export function RunPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
