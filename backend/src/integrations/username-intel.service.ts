import { Injectable } from '@nestjs/common';
import { fetchJson } from './http.util';
import { ProviderKeysService } from './provider-keys.service';

/** Perfil enriquecido de uma plataforma (GitHub, GitLab, …). */
export interface PlatformProfile {
  platform: string;
  found: boolean;
  username: string;
  name?: string | null;
  avatar?: string | null;
  bio?: string | null;
  url?: string | null;
  followers?: number;
  following?: number;
  repos?: number;
  createdAt?: string | null;
  lastActivity?: string | null;
  languages?: { name: string; count: number }[];
  links?: string[];
  location?: string | null;
  company?: string | null;
  error?: string;
}

/**
 * Username Intelligence — não diz só "existe": coleta dados públicos ricos das
 * plataformas que expõem API (GitHub/GitLab). Token `github` (provider_keys)
 * opcional eleva o rate-limit de 60→5000/h.
 */
@Injectable()
export class UsernameIntelService {
  constructor(private readonly keys: ProviderKeysService) {}

  async enrich(handle: string): Promise<{ handle: string; platforms: PlatformProfile[] }> {
    const h = handle.replace(/^@/, '').trim();
    const [github, gitlab] = await Promise.all([this.github(h), this.gitlab(h)]);
    return { handle: h, platforms: [github, gitlab] };
  }

  private async github(h: string): Promise<PlatformProfile> {
    const token = await this.keys.getKey('github');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const { status, json: u } = await fetchJson<any>(
        `https://api.github.com/users/${encodeURIComponent(h)}`,
        { headers },
      );
      if (status === 404) return { platform: 'github', found: false, username: h };
      if (status !== 200 || !u) return { platform: 'github', found: false, username: h, error: `HTTP ${status}` };

      let languages: { name: string; count: number }[] = [];
      let lastActivity: string | undefined;
      try {
        const { json: repos } = await fetchJson<any[]>(
          `https://api.github.com/users/${encodeURIComponent(h)}/repos?per_page=100&sort=pushed`,
          { headers },
        );
        if (Array.isArray(repos)) {
          const counts: Record<string, number> = {};
          for (const r of repos) {
            if (r.language) counts[r.language] = (counts[r.language] ?? 0) + 1;
            if (r.pushed_at && (!lastActivity || r.pushed_at > lastActivity)) lastActivity = r.pushed_at;
          }
          languages = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
        }
      } catch {
        /* repos opcionais */
      }

      const links: string[] = [];
      if (u.blog) links.push(String(u.blog).startsWith('http') ? u.blog : `https://${u.blog}`);
      if (u.twitter_username) links.push(`https://twitter.com/${u.twitter_username}`);

      return {
        platform: 'github',
        found: true,
        username: u.login,
        name: u.name,
        avatar: u.avatar_url,
        bio: u.bio,
        url: u.html_url,
        followers: u.followers,
        following: u.following,
        repos: u.public_repos,
        createdAt: u.created_at,
        lastActivity,
        languages,
        links,
        location: u.location,
        company: u.company,
      };
    } catch (e) {
      return { platform: 'github', found: false, username: h, error: String(e) };
    }
  }

  private async gitlab(h: string): Promise<PlatformProfile> {
    try {
      const { status, json } = await fetchJson<any[]>(
        `https://gitlab.com/api/v4/users?username=${encodeURIComponent(h)}`,
      );
      if (status !== 200 || !Array.isArray(json) || json.length === 0)
        return { platform: 'gitlab', found: false, username: h };
      const u = json[0];
      return {
        platform: 'gitlab',
        found: true,
        username: u.username,
        name: u.name,
        avatar: u.avatar_url,
        bio: u.bio || null,
        url: u.web_url,
        createdAt: u.created_at,
        location: u.location || null,
        links: u.public_email ? [u.public_email] : [],
      };
    } catch {
      return { platform: 'gitlab', found: false, username: h };
    }
  }
}
