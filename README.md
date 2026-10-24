# qa-authoring-web

Angular front end for the Muso Q&A authoring engine (`q-a-authoring-engine`). Conventions, tooling
and charte graphique mirror `budgetisation-angular`.

## Run locally

```bash
nvm use && npm ci
npm start            # http://localhost:4200, talks to http://localhost:8000
```

Run the engine with `QA_AUTHORING_AUTH_PROVIDER=dev`,
`QA_AUTHORING_CORS_ALLOWED_ORIGINS=http://localhost:4200` and
`QA_AUTHORING_BOOTSTRAP_ADMIN_EMAIL` set to the email in
`src/app/core/config/environment.development.ts` (sent as `X-Dev-User`).

## Scripts

| Script               | What                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| `npm test`           | Vitest (jsdom) via `ng test`                                                   |
| `npm run lint`       | Prettier check                                                                 |
| `npm run build`      | Production build                                                               |
| `npm run gen:api`    | `core/api/contract/openapi.json` → `core/api/generated/schema.ts` (never edit) |
| `npm run fonts:sync` | Copy the brand webfonts from `@fontsource` into `public/fonts/`                |

## Layout

- `core/api/` — `ApiPort` (abstract class = contract + token) and its `HttpApiAdapter`; the engine's
  contract copy and generated types.
- `core/auth/` — `AuthPort`, the `DevAuthAdapter` (`X-Dev-User`) and the interceptor that attaches
  the identity to engine calls only. An Entra/MSAL adapter slots in behind the same port.
- `core/config/` — per-build environment (file replacement in `angular.json`).
- `core/i18n/` — Transloco behind `Translator`; French default and fallback.
- `layout/` — the shell. `features/` — one folder per feature.
- `src/styles/` — Muso design tokens, typography and Material theme.
