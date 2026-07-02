"use client";

interface ChatHeaderProps {
  user: {
    login: string;
  };
  org: {
    login: string;
  };
}

export function ChatHeader({ user, org }: ChatHeaderProps) {
  return (
    <header>
      <h2>Operator Control Room Header</h2>
      <p>{org.login}</p>
      <p>{user.login}</p>
    </header>
  );
}
