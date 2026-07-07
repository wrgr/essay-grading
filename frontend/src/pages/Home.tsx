import { useAuth } from '../auth';

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      <header className="mb-5 border-b pb-4" style={{ borderColor: 'var(--gridline)' }}>
        <div className="kicker">Welcome, {user?.displayName}</div>
        <h1 className="font-display mt-0.5 text-[1.7rem] leading-tight" style={{ fontWeight: 560 }}>
          Home
        </h1>
      </header>
      <div className="card p-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Assessment sessions and tasks will appear here.
      </div>
    </div>
  );
}
