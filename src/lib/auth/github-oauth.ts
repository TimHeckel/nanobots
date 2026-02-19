/**
 * GitHub OAuth helper functions for nanobots.sh authentication.
 */

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

interface GitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
}

/**
 * Build the GitHub OAuth authorization URL.
 */
export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("GITHUB_OAUTH_CLIENT_ID is not set");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/github/callback`,
    scope: "read:user,user:email,read:org",
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET must be set"
    );
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      data.error_description ?? data.error ?? "Failed to obtain access token"
    );
  }

  return data.access_token;
}

/**
 * Fetch the authenticated GitHub user's profile.
 */
export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.status}`);
  }

  const data = (await response.json()) as GitHubUser;
  return {
    id: data.id,
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    email: data.email,
  };
}

/**
 * Fetch the authenticated user's primary verified email from GitHub.
 */
export async function fetchGitHubEmail(token: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) return null;

    const emails = (await response.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const primary = emails.find((e) => e.primary && e.verified);
    return primary?.email ?? emails.find((e) => e.verified)?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the organizations the authenticated user belongs to.
 */
export async function fetchUserOrgs(token: string): Promise<GitHubOrg[]> {
  const response = await fetch("https://api.github.com/user/orgs", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user orgs: ${response.status}`);
  }

  return (await response.json()) as GitHubOrg[];
}
