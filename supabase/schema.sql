-- ============================================================
-- ESQUEMA DE BASE DE DATOS - INVENTARIO DE ALMACEN
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query
-- ============================================================

-- 1. PERFILES DE USUARIO (extiende auth.users de Supabase)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'viewer' check (role in ('admin','operator','viewer')),
  created_at timestamptz default now()
);

-- Crea automáticamente un perfil cuando alguien se registra
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'viewer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. PROYECTOS (las "pestañas" del Excel)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- ej. "25-58723 Bay Lake ES"
  name text,
  created_at timestamptz default now()
);

-- 3. ACCESO A PROYECTOS (a qué proyectos puede entrar cada usuario; los admin ven todos)
create table public.project_access (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (project_id, user_id)
);

-- 4. PARTES / MATERIALES (la fila del BOM)
create table public.parts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  date date,
  po text,
  vendor text,
  part_no text not null,
  location text,
  qty_required numeric not null default 0,   -- viene del BOM, se edita manualmente
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 5. ORDENES DE COMPRA (para calcular Qty Ordered automáticamente, permite varias por parte)
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  po_number text,
  qty_ordered numeric not null,
  date date default current_date,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 6. MOVIMIENTOS (entradas y salidas, historial ilimitado -> reemplaza las columnas repetidas del Excel)
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  type text not null check (type in ('IN','OUT')),
  qty numeric not null check (qty > 0),
  date date default current_date,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- VISTA: resumen de cada parte con cantidades calculadas
-- ============================================================
create view public.parts_summary as
select
  p.*,
  coalesce((select sum(po.qty_ordered) from public.purchase_orders po where po.part_id = p.id), 0) as qty_ordered,
  coalesce((select sum(m.qty) from public.movements m where m.part_id = p.id and m.type = 'IN'), 0) as qty_in,
  coalesce((select sum(m.qty) from public.movements m where m.part_id = p.id and m.type = 'OUT'), 0) as qty_out,
  coalesce((select sum(m.qty) from public.movements m where m.part_id = p.id and m.type = 'IN'), 0)
    - coalesce((select sum(m.qty) from public.movements m where m.part_id = p.id and m.type = 'OUT'), 0) as qty_available
from public.parts p;

-- ============================================================
-- SEGURIDAD (RLS) - controla qué puede ver/hacer cada rol
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_access enable row level security;
alter table public.parts enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.movements enable row level security;

-- función helper: rol del usuario actual
create function public.current_role() returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- función helper: el usuario tiene acceso a este proyecto?
create function public.has_project_access(pid uuid) returns boolean as $$
  select public.current_role() = 'admin'
    or exists (select 1 from public.project_access where project_id = pid and user_id = auth.uid());
$$ language sql stable security definer;

-- PROFILES: todos pueden leer perfiles (para ver nombres), solo admin edita roles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_self_or_admin" on public.profiles for update
  using (auth.uid() = id or public.current_role() = 'admin');

-- PROJECTS: todos los logueados pueden leer; solo admin crea/edita
create policy "projects_select" on public.projects for select using (auth.role() = 'authenticated');
create policy "projects_insert" on public.projects for insert with check (public.current_role() = 'admin');
create policy "projects_update" on public.projects for update using (public.current_role() = 'admin');

-- PROJECT_ACCESS: solo admin administra
create policy "project_access_all" on public.project_access for all using (public.current_role() = 'admin');

-- PARTS: leer solo si tiene acceso al proyecto; escribir admin/operator con acceso
create policy "parts_select" on public.parts for select using (public.has_project_access(project_id));
create policy "parts_insert" on public.parts for insert with check (
  public.has_project_access(project_id) and public.current_role() in ('admin','operator')
);
create policy "parts_update" on public.parts for update using (
  public.has_project_access(project_id) and public.current_role() in ('admin','operator')
);
create policy "parts_delete" on public.parts for delete using (public.current_role() = 'admin');

-- PURCHASE_ORDERS y MOVEMENTS: mismas reglas, vía la parte relacionada
create policy "po_select" on public.purchase_orders for select using (
  exists (select 1 from public.parts p where p.id = part_id and public.has_project_access(p.project_id))
);
create policy "po_insert" on public.purchase_orders for insert with check (
  public.current_role() in ('admin','operator') and
  exists (select 1 from public.parts p where p.id = part_id and public.has_project_access(p.project_id))
);

create policy "movements_select" on public.movements for select using (
  exists (select 1 from public.parts p where p.id = part_id and public.has_project_access(p.project_id))
);
create policy "movements_insert" on public.movements for insert with check (
  public.current_role() in ('admin','operator') and
  exists (select 1 from public.parts p where p.id = part_id and public.has_project_access(p.project_id))
);

-- Nota: la vista parts_summary hereda las políticas RLS de la tabla "parts".

-- ============================================================
-- PERMISOS DE TABLA (necesario en proyectos nuevos de Supabase:
-- ya no se otorgan automáticamente, hay que darlos explícitamente
-- además de las políticas RLS de arriba)
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.parts_summary to authenticated;

