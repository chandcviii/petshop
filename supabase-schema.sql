create table if not exists public.pets (
    id text primary key,
    name text not null,
    type text not null,
    breed text not null,
    age integer not null check (age >= 0),
    gender text not null check (gender in ('Male', 'Female')),
    status text not null check (status in ('Available', 'Sold')),
    created_at timestamptz not null default now()
);

create table if not exists public.products (
    id text primary key,
    name text not null,
    category text not null,
    price numeric(12, 2) not null check (price >= 0),
    stock integer not null check (stock >= 0),
    created_at timestamptz not null default now()
);

create table if not exists public.customers (
    id text primary key,
    name text not null,
    phone text not null,
    email text not null,
    address text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.employees (
    id text primary key,
    name text not null,
    role text not null,
    phone text not null,
    email text not null,
    hire_date date not null,
    created_at timestamptz not null default now()
);

create table if not exists public.shop_settings (
    id integer primary key default 1 check (id = 1),
    shop_name text not null,
    address text not null,
    phone text not null,
    email text not null,
    version text not null default '1.0',
    updated_at timestamptz not null default now()
);

create sequence if not exists public.sales_invoice_number_seq;

create table if not exists public.sales (
    id text primary key default (
        'INV-' || lpad(nextval('public.sales_invoice_number_seq')::text, 4, '0')
    ),
    sold_at timestamptz not null default now(),
    customer_id text references public.customers(id) on delete set null,
    customer_name text not null,
    product_id text references public.products(id) on delete set null,
    product_name text not null,
    quantity integer not null check (quantity > 0),
    unit_price numeric(12, 2) not null check (unit_price >= 0),
    total numeric(14, 2) not null check (total = quantity * unit_price)
);

create index if not exists sales_sold_at_idx on public.sales (sold_at desc);
create index if not exists sales_customer_id_idx on public.sales (customer_id);
create index if not exists sales_product_id_idx on public.sales (product_id);

alter table public.pets enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.employees enable row level security;
alter table public.shop_settings enable row level security;
alter table public.sales enable row level security;

revoke all on public.pets, public.products, public.customers, public.employees,
    public.shop_settings, public.sales from anon;

grant select, insert, update, delete on public.pets, public.products, public.customers,
    public.employees, public.shop_settings to authenticated;
grant select on public.sales to authenticated;

drop policy if exists pets_authenticated_access on public.pets;
create policy pets_authenticated_access
    on public.pets for all to authenticated
    using (true) with check (true);

drop policy if exists products_authenticated_access on public.products;
create policy products_authenticated_access
    on public.products for all to authenticated
    using (true) with check (true);

drop policy if exists customers_authenticated_access on public.customers;
create policy customers_authenticated_access
    on public.customers for all to authenticated
    using (true) with check (true);

drop policy if exists employees_authenticated_access on public.employees;
create policy employees_authenticated_access
    on public.employees for all to authenticated
    using (true) with check (true);

drop policy if exists shop_settings_authenticated_access on public.shop_settings;
create policy shop_settings_authenticated_access
    on public.shop_settings for all to authenticated
    using (true) with check (true);

drop policy if exists sales_authenticated_read on public.sales;
create policy sales_authenticated_read
    on public.sales for select to authenticated
    using (true);

create or replace function public.create_sale(
    p_customer_id text,
    p_product_id text,
    p_quantity integer
)
returns setof public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_customer public.customers%rowtype;
    v_product public.products%rowtype;
    v_sale public.sales%rowtype;
begin
    if auth.uid() is null then
        raise exception 'Authentication is required to record a sale'
            using errcode = '42501';
    end if;

    if p_quantity is null or p_quantity < 1 then
        raise exception 'Sale quantity must be a positive whole number'
            using errcode = '22023';
    end if;

    select *
    into v_customer
    from public.customers
    where id = p_customer_id;

    if not found then
        raise exception 'Customer was not found'
            using errcode = 'P0002';
    end if;

    select *
    into v_product
    from public.products
    where id = p_product_id
    for update;

    if not found then
        raise exception 'Product was not found'
            using errcode = 'P0002';
    end if;

    if v_product.stock < p_quantity then
        raise exception 'Insufficient stock for product %', v_product.name
            using errcode = '22023';
    end if;

    update public.products
    set stock = stock - p_quantity
    where id = v_product.id;

    insert into public.sales (
        customer_id,
        customer_name,
        product_id,
        product_name,
        quantity,
        unit_price,
        total
    )
    values (
        v_customer.id,
        v_customer.name,
        v_product.id,
        v_product.name,
        p_quantity,
        v_product.price,
        v_product.price * p_quantity
    )
    returning * into v_sale;

    return next v_sale;
end;
$$;

revoke all on function public.create_sale(text, text, integer) from public, anon;
grant execute on function public.create_sale(text, text, integer) to authenticated;
