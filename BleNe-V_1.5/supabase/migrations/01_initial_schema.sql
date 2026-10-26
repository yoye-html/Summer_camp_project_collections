
-- Enable necessary extensions
create extension if not exists "postgis";

-- Users Table (extends Supabase Auth)
create table public.users (
  id uuid references auth.users not null primary key,
  email text,
  name text not null,
  role text check (role in ('visually_impaired', 'volunteer')), -- simple check
  membership_verified boolean default false,
  stars int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.users enable row level security;

-- Policies for users
create policy "Public profiles are viewable by everyone" on public.users
  for select using (true);

create policy "Users can insert their own profile" on public.users
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Requests Table
create table public.requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.users(id) not null,
  description text,
  generalized_desc text, -- e.g. "Visually impaired person needs help nearby"
  location geometry(Point, 4326), -- Geospatial point
  status text check (status in ('pending', 'accepted', 'completed', 'cancelled')) default 'pending',
  volunteer_id uuid references public.users(id),
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Enable RLS
alter table public.requests enable row level security;

-- Policies for requests
create policy "Users can view their own requests" on public.requests
  for select using (auth.uid() = user_id);

create policy "Volunteers can view pending requests" on public.requests
  for select using (
    (auth.uid() in (select id from public.users where role = 'volunteer')) 
    and (status = 'pending' or volunteer_id = auth.uid())
  );

create policy "Users can insert requests" on public.requests
  for insert with check (auth.uid() = user_id);

create policy "Volunteers can update requests (accept/complete)" on public.requests
  for update using (
    (auth.uid() in (select id from public.users where role = 'volunteer'))
    or (auth.uid() = user_id) -- Users can cancel
  );

-- Ratings Table
create table public.ratings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  request_id uuid references public.requests(id) not null,
  from_id uuid references public.users(id) not null,
  to_id uuid references public.users(id) not null,
  rating int check (rating >= 1 and rating <= 5),
  feedback text
);

-- Enable RLS
alter table public.ratings enable row level security;

create policy "Users can read all ratings" on public.ratings
  for select using (true);

create policy "Authenticated users can insert ratings" on public.ratings
  for insert with check (auth.uid() = from_id);

-- Function to handle geo-queries (simple distance)
-- Note: Supabase JS client can filter by distance using PostGIS functions if exposed via RPC or using the .filter() modifier if simple.
-- Ideally we use a database function for "nearby requests".

create or replace function nearby_requests(lat float, long float, radius_meters float)
returns setof public.requests
language sql
as $$
  select *
  from public.requests
  where st_dwithin(
    location,
    st_setsrid(st_makepoint(long, lat), 4326),
    radius_meters
  )
  and status = 'pending'
  order by location <-> st_setsrid(st_makepoint(long, lat), 4326);
$$;
