# Deploy to a new Vercel project

This repo is **not** linked to any Vercel project. To deploy as a **new** project (not an existing one):

## 1. Deploy and create new project

In the project folder run:

```bash
npx vercel
```

When prompted:

1. **Set up and deploy?** → **Y** (Enter)
2. **Which scope?** → Choose your account/team
3. **Link to existing project?** → **N** (this creates a new project)
4. **What’s your project’s name?** → e.g. `department-store` (or any name you want)

The CLI will create the new project, deploy, and give you a preview URL.

## 2. Production deploy

After the first deploy:

```bash
npx vercel --prod
```

## 3. Environment variables

Add your env vars in the Vercel dashboard so the app works in production:

- **Project** → **Settings** → **Environment Variables**

Add the same variables you use in `.env.local`, for example:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Any others (Resend, Moolre, etc.)

Then trigger a new deploy (e.g. **Deployments** → **Redeploy** or push a new commit if you use Git integration).

---

**Note:** If you run `npx vercel --yes`, it will use defaults and may link to an existing project. To get a **new** project, run `npx vercel` without `--yes` and choose **N** for “Link to existing project?”.
