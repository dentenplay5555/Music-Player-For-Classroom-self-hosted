import { YOUTUBE_HOSTS } from '@qr-music/shared';

export function extractVideoId(rawUrl: string): string | null {
  try {
    const trimmed = rawUrl.trim();
    // Allow users who just paste the 11 character video ID directly
    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!YOUTUBE_HOSTS.has(url.hostname)) return null;

    let id: string | null = null;

    if (url.hostname === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const match = url.pathname.match(/^\/(embed|shorts)\/([A-Za-z0-9_-]+)\/?$/);
      id = match?.[2] ?? null;
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QR-Music/1.0',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = (await res.json()) as { title?: string };
      return data.title?.trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}
