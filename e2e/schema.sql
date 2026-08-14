-- Fabricated fixture data only.
create type order_status as enum ('pending', 'paid', 'shipped');

create table users (
  id serial primary key,
  ref uuid not null default gen_random_uuid(),
  email text not null,
  display_name varchar(80),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table orders (
  id serial primary key,
  user_id integer not null references users(id),
  status order_status not null default 'pending',
  total numeric(10, 2) not null,
  metadata jsonb,
  placed_at timestamptz not null default now()
);

insert into users (email, display_name, is_admin) values
  ('ada@example.test', 'Ada', true),
  ('lin@example.test', null, false);

insert into orders (user_id, status, total, metadata) values
  (1, 'paid', '49.90', '{"source": "web"}'),
  (2, 'pending', '120.00', null);
