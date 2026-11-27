import { getDb, listCliSessions, personFromToken } from '@taskyard/core';
import { cookies } from 'next/headers';
import { AccountClient } from '@/components/account-client';
import { SESSION_COOKIE } from '@/lib/web-session';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const session = token && personFromToken(db, token);
  const cliSessions = session && session.kind === 'web' && !session.mustChangePassword
    ? listCliSessions(db, session.person.id)
    : [];
  return <AccountClient cliSessions={cliSessions} />;
}
