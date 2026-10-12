'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { TestDataToggle } from '@/components/test-data-toggle';
import { useSessionPerson } from '@/components/providers';
import { useTestData as useTestDataContext } from '@/lib/hooks/use-test-data';

type AppShellProps = {
  children: React.ReactNode;
  pageTitle?: string;
  actions?: React.ReactNode;
};

export function AppShell({ children, pageTitle, actions }: AppShellProps) {
  const pathname = usePathname();
  const person = useSessionPerson();
  const { useTestData: testDataOn } = useTestDataContext();
  const avatarSrc = testDataOn ? '/user-avatar-test.png' : '/user-avatar.svg';

  const nav = [
    { href: '/overview', label: 'Overview' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/machines', label: 'Machines' },
    { href: '/projects', label: 'Projects' },
    { href: '/people', label: 'People' },
    { href: '/auto', label: 'Auto' },
  ];

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/overview');
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <Link href="/overview" className="header-brand">
          <span className="brand-mark">
            <Image src="/brand-logo.png" alt="" width={28} height={28} />
          </span>
          <span className="brand-name">Taskyard</span>
        </Link>
        <nav className="header-nav" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="header-spacer" aria-hidden="true" />
        {pageTitle ? <p className="page-title">{pageTitle}</p> : null}
        <div className="header-actions">
          {actions}
          <TestDataToggle />
          {person ? (
            <Link
              href="/account"
              className="user-session"
              aria-label={`Signed in as ${person.displayName}`}
            >
              <Image src={avatarSrc} alt="" width={32} height={32} />
              <span className="user-session-name">{person.displayName}</span>
            </Link>
          ) : null}
          {person ? (
            <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          ) : null}
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
