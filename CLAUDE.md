# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GoalWay is a React Router v7 app (framework mode, SSR) on Supabase, deployed to Netlify. It presents **missions**: ordered step-by-step guides made of reusable **instructions**, which hold text, images with numbered annotation boxes, and video. Content comes in English and Hebrew (RTL), and access is scoped by organization. The project started in the Dazl visual builder; `dazl.config.json`, `app/dazl-metadata/`, `canvases/` and `prompts/` belong to Dazl.

## Commands

```
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # react-router build (output in build/, plus the Netlify function in .netlify/)
npm run typecheck  # react-router typegen && tsc: the only static check
```

There is no test suite and no linter. Run `npm run typecheck` after changes. Route types (`./+types/<route>`) are generated into `.react-router/`, so run typecheck (or dev) after adding or renaming a route.

Environment (`.env`, not committed): `SUPABASE_PROJECT_URL`, `SUPABASE_API_KEY` (the anon key).

## Git / deploy flow

Feature branches (`claude/*`) merge into `develop` through pull requests, and `develop` merges into `main`. Netlify deploys both branches (`main` = production).

## Architecture

**Routing** is explicit in `app/routes.ts`, not file-based. English routes have Hebrew twins under `/he` (`home.tsx` ↔ `he.home.tsx`, `missions.$missionId.tsx` ↔ `he.missions.$missionId.tsx`). These pairs are near-copies, so a UI change to one usually has to be made in the other too. `api.missions.$missionId.tsx` and `api.he.missions.$missionId.tsx` are JSON loader endpoints.

**Data layer.** Use the order routes (loader/action) → `app/services/*.server.ts` → Supabase. Never import Supabase or services into client components. Tables:
- `missions` and `instructions`: each row stores the whole object as JSON in `data_en` and/or `data_he`, plus the columns `is_temp`, `source_mission_id`/`source_instruction_id`, `is_example` and `admin_notes`. The TypeScript shapes (`Mission`, `Instruction`, `Annotation`) are defined in `missions.server.ts` and `instructions.server.ts`. `migrateLegacyMission` converts the old mission format, which used `instructionIds`/`instructionTitles`.
- `organizations`, `mission_organizations` (which organizations may see a mission), `profiles` (`role: "user" | "admin"`, `organization_id`), `image_keywords` (keywords and categories per storage path).
- Images live in the Storage bucket `mission-images`.

**`Mission.instructions`** is an ordered array of `[instructionId, customTitle?]`. Some IDs are special and must be handled wherever instructions are resolved:
- `id#2`, `id#3`, …: repeated uses of the same instruction. Strip everything from `#` onward before querying.
- `T1`, `T2`, …: placeholder steps, where the title is the text.
- `if-<uuid>`, `else-…`, `end-if-<uuid>`, `comment-…`, and `"0"`: control-flow and comment markers, not real instructions.

`app/lib/flowchart2goalway.ts` turns a compressed draw.io flowchart into this structure (used by `drawio-upload-dialog`).

**Supabase clients** (`app/lib/supabase.ts`):
- `root.tsx`'s loader sends the URL and anon key to the browser, and `initSupabase()` creates the browser client. The browser session is stored in localStorage, not cookies, so it works inside the Dazl iframe.
- `getSupabase()` on the server is an **unauthenticated** anon client, used for public reads.
- `createServerSupabase(request)` reads the auth cookies, which use `SameSite=None; Secure` for iframes. `auth.server.ts` `getUserProfile()` uses it.
- Writes and admin reads must run **as the signed-in user** so that row-level security (RLS) applies. Use a client created with `Authorization: Bearer <accessToken>`. The client sends `accessToken` in the form data, and actions pass it to the service functions (for example `assignUserOrganization(..., accessToken)` and `upsertImageKeywords(..., accessToken)`). There is no service-role key. The RLS setup is in `supabase/sql/` (numbered scripts that are run by hand in the Supabase SQL editor).

**Access rules:**
- A mission is visible when it is `is_example` or linked to the user's organization through `mission_organizations` (`checkMissionAccess`).
- `is_temp` rows are never shown to users.
- The home loader returns different shapes for admins and for users. Only the admin version includes `missionsWithAccess` and `organizations`, so check for those fields with `"x" in loaderData` before reading them.
- The `?org=` filter is remembered in the `org_filter` cookie (`org-filter.server.ts`).

**Admin** (`admin.tsx`, `admin.missions.tsx`, `admin.instructions.tsx`, `instructions-with-images.tsx`) is large and action-driven: one `action` dispatches on a form `intent`/action-type field. "Test mode" clones a mission and its instructions into `is_temp` rows (only one temp mission may exist at a time), and the admin later publishes or discards it.

## Conventions (from `prompts/`)

- Styling: CSS Modules only (a `component-name.module.css` file next to each component, imported by it), Open Props tokens from `app/styles/tokens/`, and semantic tokens in `app/styles/theme.css`. No Tailwind.
- UI building blocks: Radix-based components in `app/components/ui/`. Icons: `lucide-react`; check that the named export exists before using it.
- Use kebab-case file names and one component per file. Load Google Fonts through the `links` export in `root.tsx`, not CSS `@import`.
- Use React Router v7 APIs only.
- Check table and column names against the real schema (or the services' `select`s) rather than guessing.
