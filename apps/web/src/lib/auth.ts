import 'dotenv/config';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { redirect } from 'next/navigation';
import { pool } from '@tracker/db';
const derive = promisify(scrypt);
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Owner account',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password || credentials.password.length > 256)
          return null;
        const owner = process.env.OWNER_EMAIL?.toLowerCase();
        const encoded = process.env.OWNER_PASSWORD_HASH;
        if (!owner || !encoded || !process.env.NEXTAUTH_SECRET) return null;
        // Global owner login throttle: ten attempts per fifteen-minute window, shared across processes.
        const throttle = await pool.query<{
          count: number;
        }>(`INSERT INTO login_attempts(key,count,expires_at) VALUES('owner-login',1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.expires_at<now() THEN 1 ELSE login_attempts.count+1 END,
    expires_at=CASE WHEN login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.expires_at END RETURNING count`);
        if (throttle.rows[0].count > 10) return null;
        const [scheme, salt, digest] = encoded.split('$');
        if (scheme !== 'scrypt' || !salt || !digest) return null;
        const expected = Buffer.from(digest, 'hex');
        if (expected.length !== 64) return null;
        const actual = (await derive(credentials.password, salt, 64)) as Buffer;
        const valid =
          timingSafeEqual(actual, expected) && credentials.email.toLowerCase().trim() === owner;
        if (!valid) return null;
        await pool.query('DELETE FROM login_attempts WHERE key=$1', ['owner-login']);
        return { id: owner, email: owner, name: 'Owner' };
      },
    }),
  ],
};
export async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== process.env.OWNER_EMAIL?.toLowerCase())
    redirect('/login');
  return session.user.email;
}
