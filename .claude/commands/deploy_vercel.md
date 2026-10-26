---
description: Build this project and deploy it to Vercel production, then report the live URL
allowed-tools: Bash(npm run build:*), Bash(npx vercel:*), Bash(npx --yes vercel:*), Read, Write
---

Deploy this project to Vercel production and give me the public URL.

1. Make sure `vercel.json` exists at the repo root with at least:
   ```json
   { "framework": "vite", "buildCommand": "npm run build", "outputDirectory": "build" }
   ```
   (Vite here builds to `./build`, not Vercel's default `./dist`.) Create or fix it if needed.
2. Run `npm run build` locally first. If it fails, stop and show me the error. Don't deploy.
3. Check login with `npx --yes vercel whoami`. If I'm not logged in, stop and tell me to run `! npx vercel login`, then re-run this command.
4. Deploy: `npx --yes vercel deploy --prod --yes`. On the first run this links the folder to a new Vercel project (it creates `.vercel/`, which should be gitignored).
5. Report the production URL from the output (the stable `https://<project>.vercel.app` alias, not only the per-deployment URL).

Note: Vercel serves only the static frontend. `server/index.mjs` (SQLite auth/scores) does not run there, so sign-up/sign-in fail on the deployed site and only **guest mode** works. Mention this when reporting the URL.

$ARGUMENTS
