'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>The workspace could not load.</h1>
      <p>
        Check your database connection and run <code>pnpm db:migrate</code> before starting the app.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
