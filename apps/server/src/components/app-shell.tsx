'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { TestDataToggle } from '@/components/test-data-toggle';
import { useTestData as useTestDataContext } from '@/lib/hooks/use-test-data';

type AppShellProps = {
  children: React.ReactNode;
  pageTitle?: string;
  actions?: React.ReactNode;
};

export function AppShell({ children, pageTitle, actions }: AppShellProps) {
  const pathname = usePathname();
  const { useTestData: testDataOn } = useTestDataContext();
  const avatarSrc = testDataOn ? '/user-avatar-test.png' : '/user-avatar.svg';

  const nav = [
    { href: '/overview', label: 'Overview' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/machines', label: 'Machines' },
    { href: '/projects', label: 'Projects' },
    { href: '/auto', label: 'Auto' },
  ];

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
          <button type="button" className="user-session" aria-label="Signed in as Peter">
            <Image src={avatarSrc} alt="" width={32} height={32} />
          </button>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
