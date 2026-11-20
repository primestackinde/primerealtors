# React + Vite

Prime Realtors website (prime-realtors.in).

- **Article CMS / blog**: see [`docs/BLOG_CMS.md`](docs/BLOG_CMS.md) for the
  content model, the `/admin` editor, SEO behaviour and the one-time Supabase
  setup steps.
- **Status / test plan**: [`docs/STATUS_AND_TEST_PLAN.md`](docs/STATUS_AND_TEST_PLAN.md)
  — what has been done and verified, what still needs testing, and the
  remaining implementation steps.
- Commands: `npm run dev` (local), `npm run build` (bundle),
  `npm run lint` (oxlint), `npm test` (vitest).

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
