# Fix 404 NOT_FOUND on Vercel homepage

If you see **404: NOT_FOUND** when opening your deployment URL (e.g. `https://department-store-….vercel.app/`), Vercel is likely not building or serving the app as Next.js. Fix it as follows.

## 1. Set Framework and Build in the dashboard

1. Open [Vercel Dashboard](https://vercel.com/dashboard) and select your project (**department-store**).
2. Go to **Settings** → **General**.
3. Set **Framework Preset** to **Next.js** (if it is "Other" or anything else, change it).
4. Leave **Build Command** as default (`npm run build` or empty so it uses `package.json`).
5. Leave **Output Directory** empty (Vercel uses the default for Next.js).
6. Under **Node.js Version**, choose **20.x** (or at least 18.x).

## 2. Redeploy

- Go to **Deployments**.
- Open the **⋯** menu on the latest deployment → **Redeploy**.
- Uncheck **Use existing Build Cache** so it does a full rebuild.

## 3. Confirm the build

- Open the latest deployment and check the build logs.
- You should see `next build` and "Compiled successfully" with no errors.

After a successful redeploy, the root URL should load the store homepage. If it still returns 404, check the deployment **Build Logs** for errors.

---

This project’s `vercel.json` already sets `"framework": "nextjs"` and `"buildCommand": "npm run build"` so that new deployments use the correct settings. If the project was created with a different preset, updating it in the dashboard and redeploying fixes the 404.
