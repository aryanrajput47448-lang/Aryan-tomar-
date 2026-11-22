# TorqSmash Growth MCP

A Remote Model Context Protocol (MCP) server for planning and researching content for the TorqSmash BeamNG.drive gameplay channel.

## Important capability boundaries

- Claude writes the final titles, descriptions, hooks and analysis using the structured guidance returned by these tools.
- The server provides public YouTube search/channel data when `YOUTUBE_API_KEY` is configured.
- YouTube Data API does **not** provide monthly keyword search volume or keyword difficulty.
- `analyze_video_brief` reviews text notes only. This server does not decode uploaded video files, inspect frames or hear audio.
- Private YouTube Studio analytics require a separate Google OAuth flow and YouTube Analytics API implementation; they are not included here.
- This server does not upload, publish, edit or delete videos.

## Included tools

1. `generate_seo_package`
2. `generate_titles`
3. `research_keywords`
4. `analyze_competitors`
5. `analyze_video_brief`
6. `generate_shorts_hooks`
7. `generate_thumbnail_text`
8. `analyze_channel_public`

## Files

- `src/index.ts` — MCP server and tool definitions
- `package.json` — Node dependencies and commands
- `tsconfig.json` — TypeScript build settings
- `Dockerfile` — production container build
- `render.yaml` — Render deployment blueprint
- `.env.example` — environment variable template
- `.gitignore` — excludes secrets and build files

## Requirements

- Node.js 20 or newer
- A public HTTPS host reachable on port 443
- A strong `MCP_API_KEY` (minimum 32 characters)
- Optional Google Cloud YouTube Data API v3 key

## Local setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Put a random secret of at least 32 characters in `MCP_API_KEY`.
4. Optionally add a YouTube Data API v3 key to `YOUTUBE_API_KEY`.
5. Run:

```bash
npm install
npm run check
npm run build
npm start
```

Health check: `http://localhost:3000/health`
MCP endpoint: `http://localhost:3000/mcp`

For local development with automatic restart, use `npm run dev`.

## GitHub upload (important)

Upload the **contents** of the `torqsmash-mcp` folder to the root of a GitHub repository. The repository root must look like this:

```text
repository-root/
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── package.json
├── render.yaml
├── tsconfig.json
└── src/
    └── index.ts
```

Do not upload the outer ZIP file as your only repository file. Do not upload `.env`, `node_modules`, or `dist`.

## Deploy on Render

1. Create a GitHub repository and upload the files using the structure above.
2. In Render, choose **New → Blueprint** and select the repository (or create a Web Service using the Docker runtime).
3. Render reads `render.yaml`. Set the optional `YOUTUBE_API_KEY` in the service environment if you want live public YouTube lookups.
4. Confirm `MCP_API_KEY` is generated and remains private. If you deploy manually, create a random secret of at least 32 characters and set it as an environment variable.
5. Deploy and wait for the service to become live.
6. Open `https://YOUR-SERVICE.onrender.com/health`. It should return JSON with `"ok": true`.
7. Your MCP URL is `https://YOUR-SERVICE.onrender.com/mcp`.

The free hosting tier may sleep or have limits that make remote tool calls unreliable. Use an always-on plan for consistent availability if needed.

## Add to Claude

In Claude, open **Customize → Connectors → Add custom connector** (labels may vary), select the custom web/remote MCP option, and enter the full HTTPS MCP URL ending in `/mcp`.

For this server's API-key authentication, select **No sign-in** if offered, then add a fixed request header if your Claude account exposes the Request headers section:

- Header: `Authorization`
- Value: `Bearer YOUR_MCP_API_KEY`

Claude's fixed request-header feature may be limited by account or organization availability. If Request headers is not shown, do not remove server authentication. Use an OAuth-enabled deployment instead or wait until fixed request headers are available for your account.

Claude's remote connector must be publicly reachable over standard HTTPS port 443. See Anthropic's current help article: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

## Test prompts in Claude

- "Use `generate_seo_package` for this BeamNG.drive Short. The video shows: [describe exactly what happens]."
- "Use `research_keywords` for BeamNG.drive car obstacle challenge in the US. Do not invent search volumes."
- "Use `analyze_competitors` for BeamNG.drive crash challenge and compare public title patterns."
- "Use `analyze_video_brief` with these timestamp notes: 0:00 ..."

## Security

- Keep `MCP_API_KEY` private. Anyone who has it can call the tools.
- Never commit `.env` or paste secrets into chats, screenshots or public repositories.
- If a key is exposed, rotate it in the hosting environment.
- Do not add video publishing or deletion permissions unless you deliberately build and review that feature.
