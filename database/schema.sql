-- Portable Supabase/PostgreSQL starting point. Synthetic API mode does not require it.
create extension if not exists pgcrypto;
create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text unique not null,
  title text not null,
  fraud_type text not null,
  reported_amount numeric not null,
  status text not null default 'NEW',
  priority text not null default 'MEDIUM',
  description text not null,
  source_type text not null default 'USER_PROVIDED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id),
  actor text not null,
  action text not null,
  source_type text not null,
  model_version text,
  created_at timestamptz not null default now()
);
create index if not exists cases_status_idx on cases(status);
create index if not exists audit_case_idx on audit_logs(case_id, created_at desc);

-- Historical geographic intelligence. All records must retain their source.
-- This table is optional for the prototype; the running demo uses a deterministic
-- synthetic provider and can be replaced with this PostgreSQL/PostGIS store.
create table if not exists historical_suspicious_transactions (
  id text primary key,
  case_id text not null,
  transaction_id text unique not null,
  transaction_type text not null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'INR',
  timestamp timestamptz not null,
  source_entity_id text,
  destination_entity_id text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  state text not null,
  district text not null,
  city text not null,
  pincode text,
  location_type text not null,
  risk_score numeric not null check (risk_score between 0 and 100),
  risk_category text not null,
  fraud_type text not null,
  data_source text not null,
  created_at timestamptz not null default now()
);
create index if not exists historical_transactions_timestamp_idx on historical_suspicious_transactions(timestamp desc);
create index if not exists historical_transactions_case_idx on historical_suspicious_transactions(case_id);
create index if not exists historical_transactions_filters_idx on historical_suspicious_transactions(state, district, city, fraud_type, risk_score);
create index if not exists historical_transactions_coordinates_idx on historical_suspicious_transactions(latitude, longitude);

-- Enable only when PostGIS has been provisioned. This keeps the schema usable
-- on ordinary PostgreSQL while documenting the production spatial index.
-- alter table historical_suspicious_transactions add column geom geometry(Point, 4326);
-- create index historical_transactions_geom_idx on historical_suspicious_transactions using gist(geom);
