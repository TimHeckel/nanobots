export function isPlatformAdmin(email: string | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  const allowed = adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
