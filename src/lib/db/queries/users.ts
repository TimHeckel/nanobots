import { sql } from "../index";
import type { User } from "../schema";

export async function upsertUser(data: {
  github_id: number;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  email?: string | null;
}): Promise<User> {
  const email = data.email ?? null;
  const { rows } = await sql<User>`
    INSERT INTO users (github_id, github_login, name, avatar_url, email)
    VALUES (${data.github_id}, ${data.github_login}, ${data.name}, ${data.avatar_url}, ${email})
    ON CONFLICT (github_id)
    DO UPDATE SET github_login = ${data.github_login}, name = ${data.name}, avatar_url = ${data.avatar_url}, email = ${email}
    RETURNING *
  `;
  return rows[0];
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await sql<User>`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getUserByGithubId(githubId: number): Promise<User | null> {
  const { rows } = await sql<User>`SELECT * FROM users WHERE github_id = ${githubId}`;
  return rows[0] ?? null;
}
