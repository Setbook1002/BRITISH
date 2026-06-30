# Supabase setup

1. Create a Supabase project at https://supabase.com.
2. In the Supabase dashboard, open SQL Editor and run:

```sql
create table if not exists public.support_cases (
  id uuid default gen_random_uuid() primary key,
  form_type text not null,
  submitted_at timestamptz default now(),
  status text not null default 'Received',
  customer_name text,
  email text,
  order_number text,
  details jsonb default '{}'::jsonb
);
```

3. Copy your Project URL and anon public key.
4. Open [supabase-config.js](supabase-config.js) and replace:
   - YOUR_SUPABASE_URL
   - YOUR_SUPABASE_ANON_KEY

5. Reload the page.
