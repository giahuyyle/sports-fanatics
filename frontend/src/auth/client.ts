import { auth } from './firebase';

export interface Account {
  id: number;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export async function accountRequest(method: 'GET' | 'POST' = 'GET'): Promise<Account> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Please sign in again.');
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await user.getIdToken(attempt === 1);
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/users/me`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (auth?.currentUser?.uid !== user.uid)
      throw new Error('Your session changed. Please try again.');
    if (response.ok) return response.json();
    if (response.status === 401 && attempt === 0) continue;
    throw new Error(
      response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'Could not load your account. Please try again.',
    );
  }
  throw new Error('Please sign in again.');
}

export function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'This email already has an account. Try signing in.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
    'auth/password-does-not-meet-requirements':
      'Your password does not meet this project’s password requirements. Try a longer password with upper and lowercase letters, numbers, and symbols.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled. You can try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled. You can try again.',
    'auth/popup-blocked': 'Allow popups for this site, or sign in with email.',
    'auth/account-exists-with-different-credential':
      'Sign in using the method you originally used for this email.',
    'auth/network-request-failed': 'Check your connection and try again.',
    'auth/unauthorized-domain': 'Sign-in is not enabled for this domain yet.',
  };
  return (
    (code && messages[code]) ||
    (code
      ? 'Could not complete this action. Please try again.'
      : error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.')
  );
}
