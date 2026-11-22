import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const PORT = Number(process.env.PORT ?? 3000);
const MCP_API_KEY = process.env.MCP_API_KEY ?? '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? '';
const CHANNEL_NAME = process.env.CHANNEL_NAME ?? 'TorqSmash';
const CHANNEL_NICHE = 'BeamNG.drive gameplay, simulated vehicle physics, virtual car-crash scenarios, car-vs-obstacle challenges, and driving-game Shorts.';

if (MCP_API_KEY.length < 32) {
  throw new Error('MCP_API_KEY is required and must contain at least 32 characters. Set it in your hosting environment.');
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port number.');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token || !constantTimeEqual(token, MCP_API_KEY)) {
    res.status(401).json({ error: 'Unauthorized. Configure the Bearer token in the connector request headers.' });
    return;
  }
  next();
}

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'TorqSmash Growth MCP', version: '1.1.0' });
});

interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
}

async function youtubeSearch(query: string, maxResults: number): Promise<{ configured: boolean; note?: string; items: YouTubeVideo[] }> {
  if (!YOUTUBE_API_KEY) {
    return { configured: false, note: 'YOUTUBE_API_KEY is not set. Live YouTube lookup is unavailable; no search-volume estimates are generated.', items: [] };
  }

  const searchParams = new URLSearchParams({
    part: 'snippet', type: 'video', q: query, maxResults: String(maxResults),
    order: 'viewCount', regionCode: 'US', relevanceLanguage: 'en', key: YOUTUBE_API_KEY
  });
  const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`);
  if (!searchResponse.ok) {
    const detail = await searchResponse.text();
    throw new Error(`YouTube search request failed (${searchResponse.status}): ${detail.slice(0, 250)}`);
  }
  const searchData = await searchResponse.json() as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } }> };
  const rows = (searchData.items ?? []).flatMap((item) => {
    const videoId = item.id?.videoId;
    if (!videoId) return [];
    return [{ videoId, title: item.snippet?.title ?? '', channelTitle: item.snippet?.channelTitle ?? '', publishedAt: item.snippet?.publishedAt ?? '', url: `https://www.youtube.com/watch?v=${videoId}` }];
  });

  if (rows.length === 0) return { configured: true, items: [] };
  const statsParams = new URLSearchParams({ part: 'statistics', id: rows.map((row) => row.videoId).join(','), key: YOUTUBE_API_KEY });
  const statsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams}`);
  if (!statsResponse.ok) return { configured: true, items: rows };
  const statsData = await statsResponse.json() as { items?: Array<{ id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }> };
  const stats = new Map((statsData.items ?? []).map((item) => [item.id, item.statistics ?? {}]));
  return {
    configured: true,
    items: rows.map((row) => ({ ...row, ...stats.get(row.videoId) }))
  };
}

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'torqsmash-growth-mcp', version: '1.1.0' });

  server.tool(
    'generate_seo_package',
    'Prepare a complete USA-focused SEO brief for an actual TorqSmash BeamNG.drive video. Claude should use the returned facts and instructions to write the final copy.',
    {
      video_topic: z.string().min(5).max(1000).describe('Describe exactly what happens in the video.'),
      cars_or_objects: z.string().max(500).optional(),
      video_length_seconds: z.number().int().positive().max(3600).optional(),
      actual_outcome: z.string().max(500).optional().describe('Only state what the footage actually shows.'),
      format: z.enum(['Shorts', 'Long-form']).default('Shorts')
    },
    async (args) => textResult({
      channel: CHANNEL_NAME, audience: 'United States', language: 'American English', niche: CHANNEL_NICHE, ...args,
      keyword_seed_ideas: ['BeamNG.drive', 'BeamNG.drive crash', 'BeamNG.drive car crash', 'BeamNG.drive challenge', 'BeamNG.drive gameplay'],
      deliverables: ['10 distinct titles; score and rank the best 3', 'One ready-to-paste natural description', '3-5 relevant hashtags', '15 relevant tags, comma-separated', '5 primary and 10 secondary keyword ideas', '5 specific long-tail phrases', 'One pinned comment question'],
      rules: ['Match every claim to the supplied footage.', 'Use curiosity without misleading clickbait.', 'Do not invent search volumes, keyword difficulty, rankings, or trends.', 'Do not add unrelated GTA, art, tattoo, or generic gaming keywords.', 'Do not promise views or monetization.', 'Prefer natural American English and concise wording.']
    })
  );

  server.tool(
    'generate_titles',
    'Return title-writing criteria for a specific video; Claude generates the candidate titles and scores them.',
    {
      topic: z.string().min(5).max(1000),
      actual_outcome: z.string().max(500).optional(),
      style: z.enum(['curiosity', 'challenge', 'comparison', 'search-focused']).default('curiosity'),
      count: z.number().int().min(3).max(15).default(10)
    },
    async ({ topic, actual_outcome, style, count }) => textResult({ topic, actual_outcome, style, count, instruction: `Write ${count} distinct, concise titles in natural American English. Score each for clarity, curiosity and accuracy. Choose one winner. Mention BeamNG.drive or a relevant challenge phrase naturally where it fits. Never invent an outcome.` })
  );

  server.tool(
    'research_keywords',
    'Search public YouTube videos for US-region examples around BeamNG.drive phrases. This does not return monthly search volume or keyword difficulty.',
    {
      seed_keyword: z.string().min(2).max(200).default('BeamNG.drive car crash'),
      extra_terms: z.array(z.string().min(2).max(200)).max(4).optional(),
      max_results: z.number().int().min(3).max(20).default(10)
    },
    async ({ seed_keyword, extra_terms, max_results }) => {
      const terms = [seed_keyword, ...(extra_terms ?? [])];
      const searches = await Promise.all(terms.map(async (query) => ({ query, ...(await youtubeSearch(query, max_results)) })));
      return textResult({ region: 'US', searches, interpretation: 'Use titles and public video examples to identify wording and topics. These results are not search-volume data, keyword difficulty, or guaranteed ranking opportunities.' });
    }
  );

  server.tool(
    'analyze_competitors',
    'Find public BeamNG.drive videos in US-oriented YouTube search and return evidence for Claude to compare. Public view counts are snapshots, not private channel analytics.',
    {
      search_phrase: z.string().min(2).max(200).default('BeamNG.drive car crash challenge'),
      max_results: z.number().int().min(5).max(20).default(10)
    },
    async ({ search_phrase, max_results }) => {
      const research = await youtubeSearch(search_phrase, max_results);
      return textResult({ search_phrase, region: 'US', research, analysis_tasks: ['Group repeated title and topic patterns.', 'Compare visible public view counts without claiming why a video succeeded.', 'Identify ideas that can be adapted originally.', 'Do not copy another creator or imply access to private analytics.'] });
    }
  );

  server.tool(
    'analyze_video_brief',
    'Review a text description or timestamp notes for a BeamNG.drive gameplay Short. This tool does not directly inspect video pixels or audio.',
    {
      video_description: z.string().min(10).max(5000),
      duration_seconds: z.number().int().positive().max(3600).optional(),
      timestamp_notes: z.string().max(5000).optional(),
      intended_result: z.string().max(500).optional()
    },
    async (args) => textResult({ ...args, capability_limit: 'Text-only review. Attachments are not decoded by this server. For frame-level feedback, provide screenshots or timestamped observations in the chat.', review_checklist: ['Is the first frame immediately understandable?', 'Does the opening question match the footage?', 'Is there unnecessary setup?', 'Does each shot add information?', 'Is the result clear?', 'Is the ending satisfying and easy to follow?'], instruction: 'Give practical edit suggestions. Only give timestamps when timestamp notes support them. This is simulated gameplay; do not suggest recreating dangerous real-world stunts.' })
  );

  server.tool(
    'generate_shorts_hooks',
    'Create short, accurate on-screen opening hooks and captions for a BeamNG.drive gameplay Short.',
    {
      video_topic: z.string().min(5).max(1000),
      actual_outcome: z.string().max(500).optional(),
      count: z.number().int().min(3).max(10).default(5)
    },
    async ({ video_topic, actual_outcome, count }) => textResult({ video_topic, actual_outcome, count, instruction: `Write ${count} first-1-to-2-second hooks, plus one mid-video caption, one final reveal caption and one comment question. Keep wording short and mobile-readable. Do not promise an outcome that is not shown.` })
  );

  server.tool(
    'generate_thumbnail_text',
    'Create brief mobile-readable thumbnail or cover text options for a TorqSmash video.',
    {
      topic: z.string().min(5).max(1000),
      focus: z.enum(['car-vs-obstacle', 'simulated-crash', 'which-car-wins', 'survival-question']).default('which-car-wins')
    },
    async ({ topic, focus }) => textResult({ topic, focus, instruction: 'Create 8 American-English options, each 2-5 words. Be clear, curious and accurate. Do not claim a crash result or winner unless the video confirms it.' })
  );

  server.tool(
    'analyze_channel_public',
    'Look up publicly visible YouTube channel details. This does not access private YouTube Studio analytics.',
    {
      channel_query: z.string().min(2).max(200).default('TorqSmash')
    },
    async ({ channel_query }) => {
      if (!YOUTUBE_API_KEY) return textResult({ configured: false, message: 'Set YOUTUBE_API_KEY to enable public channel lookup. Other content-planning tools remain available.' });
      const params = new URLSearchParams({ part: 'snippet', type: 'channel', q: channel_query, maxResults: '5', key: YOUTUBE_API_KEY });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      if (!response.ok) throw new Error(`YouTube channel search failed (${response.status}).`);
      const data = await response.json() as { items?: Array<{ id?: { channelId?: string } }> };
      const ids = (data.items ?? []).flatMap((item) => item.id?.channelId ? [item.id.channelId] : []);
      if (ids.length === 0) return textResult({ channel_query, channels: [], note: 'No matching public channels were returned.' });
      const channelParams = new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), key: YOUTUBE_API_KEY });
      const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`);
      if (!channelResponse.ok) throw new Error(`YouTube channel details failed (${channelResponse.status}).`);
      const channelData = await channelResponse.json() as { items?: Array<{ id: string; snippet?: { title?: string; description?: string }; statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string } }> };
      return textResult({ channel_query, channels: (channelData.items ?? []).map((channel) => ({ channelId: channel.id, title: channel.snippet?.title, description: channel.snippet?.description, subscriberCount: channel.statistics?.subscriberCount, videoCount: channel.statistics?.videoCount, viewCount: channel.statistics?.viewCount })), privacy_note: 'Only public channel statistics are included. Private Studio impressions, retention and viewed-vs-swiped-away require separate user-authorized YouTube Analytics OAuth.' });
    }
  );

  return server;
}

app.post('/mcp', requireApiKey, async (req: Request, res: Response) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) res.status(500).json({ error: 'MCP request failed. Check the server logs.' });
  }
});

app.get('/mcp', requireApiKey, (_req, res) => {
  res.status(405).json({ error: 'This stateless MCP endpoint accepts POST requests.' });
});

app.delete('/mcp', requireApiKey, (_req, res) => {
  res.status(405).json({ error: 'This stateless MCP endpoint does not use persistent sessions.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TorqSmash Growth MCP listening on port ${PORT}`);
});
