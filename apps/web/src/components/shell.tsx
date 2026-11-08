import Link from 'next/link';
import { SignOut } from './controls';
export function CameraMark() {
  return (
    <svg viewBox="0 0 40 32" width="36" height="30" fill="none" aria-hidden="true">
      <path d="M3 8h34v21H3zM7 4h9v4H7z" stroke="currentColor" strokeWidth="2" />
      <circle cx="23" cy="18" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M7 12h7M7 16h4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <CameraMark />
          <span>
            X100<span className="brand-vi">VI</span>
            <small>THE PATIENT PURSUIT</small>
          </span>
        </Link>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav>
          <Link className="nav-item" href="/">
            ◉ &nbsp; Deal dashboard
          </Link>
          <Link className="nav-item" href="/watches/new" aria-label="Create a watch">
            ＋ &nbsp; Create a watch
          </Link>
          <Link className="nav-item" href="/import">
            ↓ &nbsp; Import a listing
          </Link>
        </nav>
        <div className="sidebar-note">
          <span className="tiny-dot" /> ONE CAMERA. YOUR PRICE.
          <p>
            A little patience.
            <br />A better deal.
            <br />A camera worth waiting for.
          </p>
        </div>
        <div className="sidebar-bottom">
          <span>OWNER WORKSPACE</span>
          <SignOut />
        </div>
      </aside>
      <main className="main">
        {children}
        <footer>
          Built for the pursuit, not the impulse. <span>FUJIFILM X100VI TRACKER · V0.1</span>
        </footer>
      </main>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
    </header>
  );
}
