# EquipmentShare Bid Intelligence Tracker

Live construction bid tracking dashboard for Western CT + MA territory.

## Setup

### 1. Supabase Database
- Go to supabase.com → SQL Editor → New Query
- Upload and run `seed_projects.sql` to load all projects
- Your Project URL and anon key are already configured in `src/App.jsx`

### 2. Deploy to Vercel
- Push this repo to GitHub
- Go to vercel.com → Import repo → Deploy
- No environment variables needed — Supabase keys are in the app

## File Structure
```
src/
  App.jsx        ← Main tracker (Supabase wired)
  main.jsx       ← React entry point
index.html       ← HTML shell
package.json     ← Dependencies
vite.config.js   ← Build config
seed_projects.sql ← Run once in Supabase SQL Editor to load 539 projects
```

## Weekly Workflow
1. Export CSV from Dodge (construction.com)
2. Open tracker → Import Dodge CSV
3. Projects save directly to Supabase — visible to anyone with the link instantly
