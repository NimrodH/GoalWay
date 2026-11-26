**Run the app**

- Published (`main`): [goalway.netlify.app](https://goalway.netlify.app/) · [Admin – missions](https://goalway.netlify.app/admin/missions)
- Development (`develop`): [develop--goalway.netlify.app](https://develop--goalway.netlify.app/) · [Admin – missions](https://develop--goalway.netlify.app/admin/missions)

> **Rewording missions:** in Claude Code, type `/reword <mission id>` (optionally `, do not translate: word, word`). It exports the mission from Supabase (like **Export** on the mission screen), repolishes the English and rebuilds the Hebrew, then uploads it back (like **Import**). The skill is `.claude/skills/reword/SKILL.md`; rules, glossary and tools are in `tools/reword/settings/`; files go to `tools/reword/work/` (not committed), where the original export is kept as a backup. Uploading needs an admin GoalWay account in `.env`: `GOALWAY_EMAIL=…` and `GOALWAY_PASSWORD=…`. It was moved here from the separate `repolish_goalway` project.

# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 CSS Modules for styling
- 📖 [React Router docs](https://reactrouter.com/)

### Styling & Theming

- This project uses CSS modules as the styling solution, Radix as the component library, and Open Props for styling tokens and theming
- Project theme is defined in `app/styles/theme.css`, used as a design system for all UI building
- Base design tokens are defined in `app/styles/tokens/<token-type>.css`, used as an immutable base design system for all the theme and all UI

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```
