# RepRoute AI Bid Feed — Edge Function Setup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What this does
Scans 6 CT/MA construction news and government bid sources every morning at 6am.
Uses Claude AI to extract project details. New projects appear in the 📡 AI BID FEED
tab for you to review and approve into your Bid Tracker.

## Step 1 — Install Supabase CLI
npm install -g supabase

## Step 2 — Login and link project
supabase login
supabase link --project-ref tcnknguceotzqmfhzxzo

## Step 3 — Run the SQL
Paste create_bid_feed_queue.sql into Supabase SQL Editor and run it.

## Step 4 — Get your keys
You need two keys:

1. ANTHROPIC_API_KEY
   Get at: https://console.anthropic.com
   Free tier gives $5 credit — enough for months of daily scans

2. SUPABASE_SERVICE_KEY (service_role key, NOT anon key)
   Get at: Supabase Dashboard → Settings → API → service_role

## Step 5 — Set secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
supabase secrets set SUPABASE_SERVICE_KEY=your-service-role-key-here

## Step 6 — Deploy the function
supabase functions deploy bid-feed

## Step 7 — Schedule daily at 6am
Go to: Supabase Dashboard → Edge Functions → bid-feed → Schedule
Set cron: 0 6 * * *

## Step 8 — Test it
Click "RUN SCAN NOW" in the AI Bid Feed tab in RepRoute.
Or trigger manually:
curl -X POST https://tcnknguceotzqmfhzxzo.supabase.co/functions/v1/bid-feed \
  -H "Authorization: Bearer YOUR_ANON_KEY"

## Sources scanned
- CT DOT bid opportunities
- MA Commbuys state procurement
- CT Construction News RSS
- Berkshire Eagle construction news
- Republican-American (Waterbury CT)
- CT Construction News feed

## Cost estimate
~$2-5/month in Claude API usage for daily scans
Supabase Edge Functions: free tier covers 500K invocations/month
