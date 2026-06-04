# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angry Mushroom is a monorepo for an AI-powered novel-to-video generation system. The application takes story text as input, analyzes it, generates character/location profiles, creates storyboards, and produces video shots with continuity checking.

**Technology Stack:**
- **Runtime**: Bun workspaces
- **Backend**: ElysiaJS with SQLite (Drizzle ORM)
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui
- **AI**: Alibaba Bailian integration for text/image/video generation
- **Storage**: Ali OSS for cloud file storage

## Development Commands

**Root (monorepo):**
```bash
bun run dev              # Start both server and web in parallel
bun run dev:server       # Start server only
bun run dev:web          # Start web only
bun run build            # Build web app
```

**Server ([apps/server](apps/server)):**
```bash
cd apps/server
bun run ./src/index.ts           # Run server
bun run db:generate              # Generate Drizzle migrations
bun run db:push                  # Push schema to database
```

**Web ([apps/web](apps/web)):**
```bash
cd apps/web
bun run dev              # Start dev server (port 5179)
bun run build            # TypeScript + Vite build
bun run lint             # ESLint
bun run preview          # Preview production build
```

## Architecture

### Monorepo Structure
```
apps/
  server/         # ElysiaJS backend (port 3000)
  web/            # React frontend (port 5179)
packages/
  shared/         # Shared TypeScript types
```

### Backend Architecture ([apps/server/src](apps/server/src))

**Module Pattern:** Each feature is organized as a module with `index.ts` (routes), `service.ts` (business logic), and `model.ts` (data models).

**Modules:**
- `modules/health` - Health check endpoint
- `modules/user` - User CRUD operations
- `modules/bailian` - AI model integration (text/image/video generation), reference file uploads
- `modules/novel-video` - Core novel-to-video pipeline (projects, characters, locations, shots, continuity)
- `modules/assets` - Asset library management

**Database:** [db/schema.ts](apps/server/src/db/schema.ts) defines Drizzle SQLite schema with tables for users, generation records, story projects, scenes, characters, locations, shots, and continuity reports.

**Configuration:**
- `config/models.ts` - Supported AI models and their configurations
- `config/paths.ts` - File upload paths
- `lib/oss.ts` - Ali OSS client
- `lib/bailian-client.ts` - Bailian AI client wrapper

### Frontend Architecture ([apps/web/src](apps/web/src))

**Pages:** [App.tsx](apps/web/src/App.tsx) uses React Router for navigation:
- `pages/Workspace.tsx` - Main novel-to-video pipeline workspace
- `pages/Explore.tsx` - Story exploration and analysis
- `pages/Assets.tsx` - Asset library browser
- `pages/Billing.tsx` - Billing information

**Components:**
- `components/ui/*` - shadcn/ui primitives
- `components/PromptEditor.tsx` - Prompt editing interface
- `components/ReferenceUploadZone.tsx` - File upload component
- `components/Navbar.tsx` - Navigation

**API Client:** [lib/api.ts](apps/web/src/lib/api.ts) provides typed API methods matching backend routes.

### Shared Types ([packages/shared/src](packages/shared/src))

- `novel-video.ts` - Core domain types: ProjectStatus, NovelAnalysis, CharacterProfile, SceneProfile, ShotDraft, ContinuityIssue

## Video Generation Pipeline

The novel-to-video workflow in [modules/novel-video](apps/server/src/modules/novel-video):

1. **Analyze** (`/projects/:id/analyze`) - AI extracts summary, conflicts, characters, scenes from story text
2. **Generate Characters** (`/projects/:id/characters/generate`) - Creates character profiles with appearance, costume, prompts
3. **Generate Locations** (`/projects/:id/locations/generate`) - Creates scene profiles with visual rules, camera rules, prompts
4. **Generate Storyboard** (`/projects/:id/storyboard/generate`) - Breaks story into shots with camera, continuity, timeline
5. **Check Continuity** (`/projects/:id/continuity/check`) - Validates action/emotion consistency, screen direction
6. **Rebuild Prompts** (`/projects/:id/prompts/rebuild`) - Rebuilds video prompts with character/location consistency
7. **Generate Shot Video** (`/shots/:id/generate`) - Triggers AI video generation for individual shots

Characters and locations can be manually edited via PATCH endpoints and have reference image generation/upload.

## Important Notes

- Database file: [apps/server/sqlite.db](apps/server/sqlite.db) (Git tracked)
- Server runs on port 3000, web on 5179 with `/api` proxy to server
- Background video task poller runs automatically via `bailianService.startVideoPoller()`
- Chinese language support - many UI strings and database comments are in Chinese
- OpenAPI docs available at http://localhost:3000/api/openapi
