# VINI QC Dashboard

A modern Next.js dashboard for the VINI-QC-FINAL scoring system.

## Setup

1. Install dependencies

```bash
cd dashboard
npm install
```

2. Copy environment variables

```bash
cp .env.local.example .env.local
```

3. Set the Supabase variables in `.env.local`

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

4. Run locally

```bash
npm run dev
```

## Deploying to Vercel

- Point Vercel to the `dashboard/` directory as the project root.
- Add environment variables in the Vercel dashboard:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Notes

- This app uses server-side Supabase access for dashboard data retrieval.
- The UI is intentionally lightweight and ready for iterative enhancement.
