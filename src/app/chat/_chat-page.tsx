"use client";

import { useEffect, useState } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";

interface UserData {
  id: string;
  name: string | null;
  login: string;
  avatarUrl: string | null;
}

interface OrgData {
  id: string;
  name: string | null;
  login: string;
  avatarUrl: string | null;
}

interface AuthResponse {
  user: {
    id: string;
    name: string | null;
    githubLogin: string;
    avatarUrl: string | null;
  };
  org: {
    id: string;
    name: string | null;
    githubOrgLogin: string;
    avatarUrl: string | null;
  } | null;
  isPlatformAdmin?: boolean;
}

export default function ChatPageInner({
  conversationId,
}: {
  conversationId?: string;
}) {
  const [user, setUser] = useState<UserData | null>(null);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          throw new Error("Failed to authenticate");
        }
        const data: AuthResponse = await res.json();

        setUser({
          id: data.user.id,
          name: data.user.name,
          login: data.user.githubLogin,
          avatarUrl: data.user.avatarUrl,
        });

        if (data.org) {
          setOrg({
            id: data.org.id,
            name: data.org.name,
            login: data.org.githubOrgLogin,
            avatarUrl: data.org.avatarUrl,
          });
        }

        setIsAdmin(!!data.isPlatformAdmin);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="font-mono text-2xl font-bold">
            <span className="text-brand">nano</span>
            <span className="text-foreground">bots</span>
            <span className="text-purple-accent">.sh</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="block w-2 h-2 rounded-full bg-brand pulse-dot" />
            <span className="block w-2 h-2 rounded-full bg-brand pulse-dot" style={{ animationDelay: "0.3s" }} />
            <span className="block w-2 h-2 rounded-full bg-brand pulse-dot" style={{ animationDelay: "0.6s" }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="text-red-400 font-mono text-sm">{error ?? "Unable to load user data"}</div>
          <a
            href="/api/auth/github"
            className="inline-block bg-brand text-background font-mono font-semibold px-6 py-2 rounded-lg text-sm hover:bg-brand/90 transition-colors"
          >
            Sign in with GitHub
          </a>
        </div>
      </div>
    );
  }

  const orgData: OrgData = org ?? {
    id: "",
    name: user.name,
    login: user.login,
    avatarUrl: user.avatarUrl,
  };

  return (
    <ChatInterface
      user={user}
      org={orgData}
      isPlatformAdmin={isAdmin}
      conversationId={conversationId}
    />
  );
}
