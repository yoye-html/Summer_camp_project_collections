-- 03_analytics_and_telemetry.sql
-- BleNe Connect Big Data & Telemetry Ingestion Layer

-- Enable postgis extension if not already enabled
create extension if not exists "postgis";

-- 1. Analytics Events Table (High-throughput telemetry)
create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.users(id) on delete set null,
  role text check (role in ('visually_impaired', 'volunteer', 'admin', 'system', 'anonymous')),
  event_name text not null, -- 'request_created', 'request_accepted', 'request_completed', 'request_cancelled', 'voice_matched', 'voice_fallback', 'biometric_attempt', 'response_latency', 'hazard_reported'
  category text,           -- 'roadCrossing', 'reading', 'navigation', 'identification', 'emergency', 'general'
  district text,           -- 'Piazza/Arada', 'Bole', 'Kirkos/Mexico', 'Lideta', 'Yeka', 'Addis Ketema', 'Other'
  latitude float,
  longitude float,
  location geometry(Point, 4326),
  duration_seconds float,  -- time to accept, call duration, audio length, etc.
  metadata jsonb default '{}'::jsonb
);

-- Indices for rapid analytical aggregations & spatial clustering
create index if not exists idx_analytics_events_created_at on public.analytics_events (created_at desc);
create index if not exists idx_analytics_events_name on public.analytics_events (event_name);
create index if not exists idx_analytics_events_category on public.analytics_events (category);
create index if not exists idx_analytics_events_district on public.analytics_events (district);
create index if not exists idx_analytics_events_location on public.analytics_events using gist(location);

-- Auto-populate geometry column if latitude and longitude are provided
create or replace function public.populate_analytics_event_geom()
returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null and new.location is null then
    new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_populate_analytics_geom on public.analytics_events;
create trigger trg_populate_analytics_geom
  before insert on public.analytics_events
  for each row execute procedure public.populate_analytics_event_geom();

-- 2. Row Level Security Policies
alter table public.analytics_events enable row level security;

-- Any authenticated user (or service role) can log events
create policy "Users can insert analytics events" on public.analytics_events
  for insert with check (true);

-- Admins can read all telemetry events
create policy "Admins can view analytics events" on public.analytics_events
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- 3. Analytical Summary RPC Function
create or replace function public.get_analytics_summary()
returns jsonb
language plpgsql security definer
as $$
declare
  v_total_requests bigint;
  v_completed_requests bigint;
  v_avg_response_minutes float;
  v_active_volunteers bigint;
  v_fulfillment_rate float;
  v_voice_interactions bigint;
begin
  -- Total help requests
  select count(*) into v_total_requests
  from public.requests;

  -- Completed requests
  select count(*) into v_completed_requests
  from public.requests
  where status = 'completed';

  -- Avg response latency (time from created_at to accepted_at in minutes)
  select coalesce(avg(extract(epoch from (accepted_at - created_at)) / 60.0), 0)
  into v_avg_response_minutes
  from public.requests
  where accepted_at is not null;

  -- Approved volunteers
  select count(*) into v_active_volunteers
  from public.users
  where role = 'volunteer' and status = 'approved';

  -- Fulfillment rate percentage
  if v_total_requests > 0 then
    v_fulfillment_rate := round(((v_completed_requests::float / v_total_requests::float) * 100)::numeric, 1);
  else
    v_fulfillment_rate := 100.0;
  end if;

  -- Voice interaction count from analytics_events
  select count(*) into v_voice_interactions
  from public.analytics_events
  where event_name in ('voice_matched', 'voice_fallback', 'request_created');

  return jsonb_build_object(
    'total_requests', v_total_requests,
    'completed_requests', v_completed_requests,
    'avg_response_minutes', round(v_avg_response_minutes::numeric, 1),
    'active_volunteers', v_active_volunteers,
    'fulfillment_rate', v_fulfillment_rate,
    'voice_interactions', v_voice_interactions
  );
end;
$$;

-- 4. Hourly Demand Trend RPC Function (for time-series forecasting)
create or replace function public.get_hourly_demand_trend()
returns table (
  hour_of_day int,
  request_count bigint
)
language sql security definer
as $$
  with hours as (
    select generate_series(0, 23) as hour
  ),
  counts as (
    select extract(hour from created_at)::int as hour, count(*) as cnt
    from public.requests
    group by extract(hour from created_at)::int
  )
  select
    h.hour as hour_of_day,
    coalesce(c.cnt, 0) as request_count
  from hours h
  left join counts c on h.hour = c.hour
  order by h.hour asc;
$$;

-- 5. Category Breakdown RPC Function
create or replace function public.get_category_analytics()
returns table (
  category text,
  count bigint
)
language sql security definer
as $$
  select
    coalesce(category, 'general') as category,
    count(*) as count
  from public.analytics_events
  where event_name in ('request_created', 'voice_matched')
  group by coalesce(category, 'general')
  order by count desc;
$$;

-- 6. Spatial District Analytics RPC Function
create or replace function public.get_district_analytics()
returns table (
  district text,
  request_count bigint,
  avg_latency_minutes float
)
language sql security definer
as $$
  select
    coalesce(district, 'Other / Unassigned') as district,
    count(*) as request_count,
    coalesce(round(avg(duration_seconds / 60.0)::numeric, 1), 0) as avg_latency_minutes
  from public.analytics_events
  where district is not null
  group by district
  order by request_count desc;
$$;

