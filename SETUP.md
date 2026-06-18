# SETUP.md — One-time setup (do this before Phase 0)

> The human setup steps and **where your keys go**. Everything here is non-secret. When it's done, open `prompts.html` and run **Phase 0**. For the full plan see [plan.md](./plan.md); for working rules see [CLAUDE.md](./CLAUDE.md).

## ✅ Already done

- GitHub repo: <https://github.com/jaiakashj121420004-stack/project-management-app>
- Supabase account · Cloudflare account · Node.js installed

## 🔐 Golden rule on secrets (read this)

**Never paste these into a chat, commit, screenshot, or anywhere public:**

- Supabase **`service_role`** key and the **database password**
- Cloudflare **API token** / Global API key
- GitHub **personal access token** / password

The app only ever uses **two safe, public values** — your Supabase **Project URL** and **anon public key**. These are *designed* to ship to the browser, and they live in a local **`.env`** file that Claude Code reads on your machine. The `.gitignore` already keeps `.env` out of git. I don't need any of these values myself — the build runs on your computer, not in this chat.

## 1. Grab your Supabase keys

Supabase dashboard → your project → **Settings → API**. Copy two things:

- **Project URL**
- **anon public** key  *(the one labeled `anon` / `public` — NOT `service_role`)*

Keep them handy. In Phase 0, Claude Code creates `.env` and tells you exactly where to paste them. They go in as:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 2. Connect the repo (Phase 0 runs this for you)

From the project folder, the first commit is pushed with:

```
git init
git add -A
git commit -m "chore: initial scaffold"
git branch -M main
git remote add origin https://github.com/jaiakashj121420004-stack/project-management-app.git
git push -u origin main
```

If git asks who you are, set it once:

```
git config --global user.email "jaiakashj121420004@gmail.com"
git config --global user.name "Akash"
```

## 3. Cloudflare Pages (after the first push)

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick `project-management-app`. Set:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the same two values from step 1)

Cloudflare then auto-deploys on every push to `main`. Your app gets a free `*.pages.dev` URL.

## 4. Start building

Open **`prompts.html`** → **Phase 0** (use Opus 4.8) → paste into Claude Code in this folder. Tick it off when done, and move down the list.
