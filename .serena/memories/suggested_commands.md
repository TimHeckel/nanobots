# Suggested commands for nanobots

## Dependency / repo basics
- `npm install` — install dependencies (repo is npm-oriented via `package-lock.json`)
- `git status`
- `git diff --stat`
- `rg "pattern" src cli tests` — preferred fast code search
- `rg --files src cli tests` — preferred file listing
- `find . -maxdepth 2 -type f` — generic filesystem search on Darwin

## App / local development
- `npm run dev` — start Next.js dev server on `http://localhost:6100`
- `npm run build` — production Next.js build
- `npm run start` — start built Next.js app (default Next.js port unless `PORT` is set)

## CLI development / packaging
- `npm run cli:dev` — run CLI entrypoint with Bun
- `npm run cli:build` — build local executable to `dist/nanobots`
- `npm run cli:build:linux`
- `npm run cli:build:mac-arm`
- `npm run cli:build:mac-x64`
- `npm run cli:build:all`

## Test / validation
- `npm run lint` — ESLint over the repo
- `npm test` — main Vitest suite (`tests/**/*.test.ts`, excluding integration/browser-agent suites)
- `npm run test:watch`
- `npm run test:coverage`
- `npm run test:integration` — integration tests; expects app env like `DATABASE_URL`
- `npm run e2e` — browser-focused e2e suite (`tests/e2e/browser-*.test.ts`)
- `npm run test:agents` — agent CLI/browser-provider suite

## Direct CLI usage
- `bun run cli/index.ts --help`
- `bun run cli/index.ts scan .`
- `bun run cli/index.ts list --all`
- `bun run cli/index.ts create "Find TODO comments"`
- `bun run cli/index.ts test my-bot .`
- `bun run cli/index.ts promote my-bot`
- `bun run cli/index.ts init`
- `bun run cli/index.ts auth`

## Useful environment checks
- `printenv OPENROUTER_API_KEY`
- `printenv DATABASE_URL`
- `printenv JWT_SECRET`