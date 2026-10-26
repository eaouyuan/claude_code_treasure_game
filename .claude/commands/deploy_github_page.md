---
description: Check GitHub prerequisites, push this project to a GitHub repo, deploy it to GitHub Pages, and report the live URL
argument-hint: "[repo-name]"
allowed-tools: Bash(git:*), Bash(gh:*), Bash("/c/Program Files/GitHub CLI/gh.exe":*), Bash(npm run build:*), Bash(npx --yes gh-pages:*), Bash(winget install:*), Bash(curl:*), Read, Write
---

Push this project to GitHub and deploy it to GitHub Pages, then give me the public URL.

Walk through each step in order. When a step says **stop**, tell me exactly what to run (as `! <command>` so it runs in this session) and that I should re-run `/deploy_github_page` afterwards. Don't skip ahead.

## 1. Prerequisites

1. **git**: `git --version`. If missing, stop and tell me to install Git for Windows (`! winget install --id Git.Git -e`).
2. **GitHub CLI (`gh`)**: `gh --version`. If it's not on PATH, try `"/c/Program Files/GitHub CLI/gh.exe" --version` and use that full path for every `gh` call below. If neither works, install it with `winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements`, then use the full path.
3. **GitHub login**: `gh auth status`. If not logged in, stop and tell me to run `! gh auth login --hostname github.com --git-protocol https --web` (with the full path if needed). After a successful login, run `gh auth setup-git` so `git push` uses the same credentials.
4. **Owner**: get my GitHub username with `gh api user --jq .login`. Call it `OWNER`.

## 2. Repository

1. **Repo name** (`REPO`): use `$ARGUMENTS` if given. Otherwise, if `git remote get-url origin` points at GitHub, take the name from it. Otherwise use the folder name, lowercased, with characters other than `a-z0-9._-` replaced by `-`.
2. If there's no `.git` folder, run `git init -b main`.
3. **Commit local work**: if `git status --porcelain` shows changes, first check that nothing secret is staged (`.env*`, `server/data/`, `*.db`, `.vercel/` must stay gitignored; if any would be committed, stop and ask me). Then `git add -A` and commit with the message `Deploy to GitHub Pages`. If the branch has no commits yet, this is the initial commit.
4. **Remote**:
   - If `origin` already exists, use it.
   - Else if `gh repo view OWNER/REPO` succeeds, the repo already exists: stop and ask whether to push to it or pick another name.
   - Else create it: `gh repo create REPO --public --source=. --remote=origin`. It must be **public**, because GitHub Pages on a free plan only works for public repos.
5. Push the source: `git push -u origin HEAD:main`. If the push is rejected (the remote has commits I don't have), stop and show me the error. Never force-push.

## 3. Build for Pages

GitHub serves this site under `/REPO/`, not `/`, so Vite needs that base path or every asset 404s. Pass it on the command line; don't edit `vite.config.ts`, because the Vercel deploy needs base `/`:

```bash
MSYS_NO_PATHCONV=1 npm run build -- --base=/REPO/
```

`MSYS_NO_PATHCONV=1` matters on Windows: without it, Git Bash rewrites `/REPO/` into `/Program Files/Git/REPO/` and every asset 404s. Afterwards, confirm `build/index.html` references `/REPO/assets/...`. Set it for the `gh api` calls below too.

If the build fails, stop and show me the error. Don't deploy. (The output goes to `./build`, not `./dist`.)

## 4. Deploy

1. Publish `./build` to the `gh-pages` branch:
   ```bash
   npx --yes gh-pages@6 -d build --nojekyll -m "Deploy to GitHub Pages"
   ```
2. Point Pages at that branch. First try creating the Pages site:
   ```bash
   gh api -X POST repos/OWNER/REPO/pages -f "source[branch]=gh-pages" -f "source[path]=/"
   ```
   If it says Pages already exists (HTTP 409), update it instead with the same arguments and `-X PUT`.
3. Wait for the Pages build: check `gh api repos/OWNER/REPO/pages/builds/latest --jq .status` until it's `built` (fail if it's `errored`). Then check that `curl -s -o /dev/null -w "%{http_code}" https://OWNER.github.io/REPO/` returns `200`. The first deploy can take a minute or two.

## 5. Report

Give me:
- **Live site:** `https://OWNER.github.io/REPO/`
- **Source repo:** `https://github.com/OWNER/REPO`

Note: GitHub Pages serves only the static frontend. `server/index.mjs` (SQLite auth/scores) doesn't run there, so sign-up and sign-in fail on the deployed site and only **guest mode** works. Mention this when reporting the URL.

To redeploy later, re-run `/deploy_github_page`. It commits and pushes new changes, rebuilds, and republishes `gh-pages`.
