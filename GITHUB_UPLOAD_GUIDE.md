# GitHub Upload Guide (Android or Computer)

## Correct repository layout

The files must be at the top level of the repository. Do not upload the ZIP as the only file and do not accidentally create `torqsmash-mcp/torqsmash-mcp/src` nesting.

```text
repository-root/
├── .env.example
├── .gitignore
├── Dockerfile
├── GITHUB_UPLOAD_GUIDE.md
├── README.md
├── package.json
├── render.yaml
├── tsconfig.json
└── src/
    └── index.ts
```

## Upload steps

1. Create a new GitHub repository named `torqsmash-growth-mcp`.
2. Choose **Add file → Upload files**.
3. Upload `.env.example`, `.gitignore`, `Dockerfile`, `GITHUB_UPLOAD_GUIDE.md`, `README.md`, `package.json`, `render.yaml`, and `tsconfig.json` to the repository root.
4. Create a folder named `src` and upload `index.ts` inside it. GitHub creates folders when a file path contains `src/index.ts`.
5. Commit the files.
6. Confirm the repository's first page shows `package.json`, `Dockerfile`, and `src/` (not just a ZIP archive).

Never upload `.env`, API keys, `node_modules`, or `dist`.
