/**
 * Check if a user is a platform admin.
 * Matches against PLATFORM_ADMIN_EMAILS (emails) and PLATFORM_ADMIN_LOGINS (GitHub logins).
 */
export function isPlatformAdmin(
  email: string | null,
  githubLogin?: string | null,
): boolean {
  const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const adminLogins = (process.env.PLATFORM_ADMIN_LOGINS ?? "")
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

  if (email && adminEmails.includes(email.toLowerCase())) return true;
  if (githubLogin && adminLogins.includes(githubLogin.toLowerCase())) return true;

  return false;
}
