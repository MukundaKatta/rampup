-- RampUp Initial Database Schema
-- This migration creates all core tables for the onboarding platform.

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type subscription_tier as enum ('free', 'starter', 'professional', 'enterprise');
create type user_role as enum ('owner', 'admin', 'manager', 'member', 'new_hire');
create type onboarding_status as enum ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled');
create type task_status as enum ('pending', 'in_progress', 'completed', 'skipped', 'overdue');
create type task_type as enum ('reading', 'meeting', 'setup', 'training', 'project', 'social', 'review', 'custom');
create type check_in_status as enum ('scheduled', 'completed', 'missed', 'rescheduled');
create type document_type as enum ('handbook', 'wiki', 'process', 'training', 'policy', 'other');
create type integration_provider as enum ('slack', 'google_calendar', 'google_drive', 'sendgrid');
create type notification_channel as enum ('email', 'slack', 'in_app');

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create table organizations (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    slug text not null unique,
    logo_url text,
    domain text,
    subscription_tier subscription_tier not null default 'free',
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    max_active_onboardings integer not null default 5,
    settings jsonb not null default '{
        "timezone": "America/New_York",
        "working_days": [1,2,3,4,5],
        "daily_nudge_time": "09:00",
        "weekly_digest_day": 1,
        "auto_schedule_checkins": true,
        "default_plan_duration_days": 90
    }'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_organizations_slug on organizations(slug);
create index idx_organizations_stripe_customer on organizations(stripe_customer_id);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

create table users (
    id uuid primary key references auth.users(id) on delete cascade,
    organization_id uuid not null references organizations(id) on delete cascade,
    email text not null,
    full_name text not null,
    avatar_url text,
    role user_role not null default 'member',
    department text,
    job_title text,
    manager_id uuid references users(id) on delete set null,
    slack_user_id text,
    google_calendar_id text,
    timezone text not null default 'America/New_York',
    start_date date,
    is_active boolean not null default true,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_users_org on users(organization_id);
create index idx_users_email on users(email);
create index idx_users_manager on users(manager_id);
create index idx_users_role on users(organization_id, role);

-- ============================================================
-- ROLES (template definitions for positions)
-- ============================================================

create table roles (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    title text not null,
    department text not null,
    description text,
    level text, -- e.g., 'junior', 'mid', 'senior', 'lead', 'director'
    required_skills text[] not null default '{}',
    tools_and_access text[] not null default '{}',
    key_stakeholders text[] not null default '{}',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(organization_id, title, department)
);

create index idx_roles_org on roles(organization_id);

-- ============================================================
-- ONBOARDING PLAN TEMPLATES
-- ============================================================

create table onboarding_templates (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    role_id uuid references roles(id) on delete set null,
    name text not null,
    description text,
    duration_days integer not null default 90,
    is_default boolean not null default false,
    phases jsonb not null default '[
        {"name": "Orientation", "start_day": 1, "end_day": 14, "description": "Setup, meet the team, read core docs"},
        {"name": "Learning", "start_day": 15, "end_day": 30, "description": "Shadow sessions, first small tasks"},
        {"name": "Contributing", "start_day": 31, "end_day": 60, "description": "Independent work, first project"},
        {"name": "Ownership", "start_day": 61, "end_day": 90, "description": "Full ownership, first review"}
    ]'::jsonb,
    created_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_templates_org on onboarding_templates(organization_id);
create index idx_templates_role on onboarding_templates(role_id);

-- ============================================================
-- TEMPLATE TASKS (tasks within a template)
-- ============================================================

create table template_tasks (
    id uuid primary key default uuid_generate_v4(),
    template_id uuid not null references onboarding_templates(id) on delete cascade,
    title text not null,
    description text,
    task_type task_type not null default 'custom',
    day_offset integer not null, -- day number relative to start (1-based)
    duration_minutes integer, -- estimated duration
    is_required boolean not null default true,
    dependencies uuid[] not null default '{}', -- other template_task IDs
    resources jsonb not null default '[]'::jsonb, -- [{url, title, type}]
    assignee_role text, -- who should complete: 'new_hire', 'manager', 'buddy', 'it'
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_template_tasks_template on template_tasks(template_id);
create index idx_template_tasks_day on template_tasks(template_id, day_offset);

-- ============================================================
-- ONBOARDING PLANS (active onboarding instances)
-- ============================================================

create table onboarding_plans (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    template_id uuid references onboarding_templates(id) on delete set null,
    new_hire_id uuid not null references users(id) on delete cascade,
    manager_id uuid not null references users(id) on delete cascade,
    buddy_id uuid references users(id) on delete set null,
    role_id uuid references roles(id) on delete set null,
    title text not null,
    status onboarding_status not null default 'draft',
    start_date date not null,
    target_end_date date not null,
    actual_end_date date,
    ai_generated boolean not null default false,
    ai_generation_context jsonb, -- context used for AI generation
    phases jsonb not null default '[]'::jsonb,
    completion_percentage numeric(5,2) not null default 0.00,
    notes text,
    created_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_plans_org on onboarding_plans(organization_id);
create index idx_plans_new_hire on onboarding_plans(new_hire_id);
create index idx_plans_manager on onboarding_plans(manager_id);
create index idx_plans_status on onboarding_plans(organization_id, status);

-- ============================================================
-- PLAN TASKS (tasks in an active onboarding plan)
-- ============================================================

create table plan_tasks (
    id uuid primary key default uuid_generate_v4(),
    plan_id uuid not null references onboarding_plans(id) on delete cascade,
    template_task_id uuid references template_tasks(id) on delete set null,
    title text not null,
    description text,
    task_type task_type not null default 'custom',
    status task_status not null default 'pending',
    assigned_to uuid references users(id) on delete set null,
    due_date date not null,
    completed_at timestamptz,
    completed_by uuid references users(id) on delete set null,
    is_required boolean not null default true,
    is_ai_generated boolean not null default false,
    dependencies uuid[] not null default '{}', -- other plan_task IDs
    resources jsonb not null default '[]'::jsonb,
    duration_minutes integer,
    sort_order integer not null default 0,
    phase_name text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_plan_tasks_plan on plan_tasks(plan_id);
create index idx_plan_tasks_assigned on plan_tasks(assigned_to);
create index idx_plan_tasks_status on plan_tasks(plan_id, status);
create index idx_plan_tasks_due on plan_tasks(due_date, status);

-- ============================================================
-- TASK COMPLETIONS (completion records with feedback)
-- ============================================================

create table task_completions (
    id uuid primary key default uuid_generate_v4(),
    task_id uuid not null references plan_tasks(id) on delete cascade,
    plan_id uuid not null references onboarding_plans(id) on delete cascade,
    completed_by uuid not null references users(id) on delete cascade,
    rating integer check (rating >= 1 and rating <= 5),
    feedback text,
    time_spent_minutes integer,
    completed_at timestamptz not null default now()
);

create index idx_completions_task on task_completions(task_id);
create index idx_completions_plan on task_completions(plan_id);

-- ============================================================
-- CHECK-INS (manager/buddy check-in sessions)
-- ============================================================

create table check_ins (
    id uuid primary key default uuid_generate_v4(),
    plan_id uuid not null references onboarding_plans(id) on delete cascade,
    new_hire_id uuid not null references users(id) on delete cascade,
    interviewer_id uuid not null references users(id) on delete cascade,
    scheduled_date date not null,
    scheduled_time time,
    status check_in_status not null default 'scheduled',
    check_in_day integer not null, -- day number (7, 14, 30, 60, 90)
    calendar_event_id text, -- Google Calendar event ID
    ai_suggested_questions jsonb not null default '[]'::jsonb,
    notes text,
    mood_rating integer check (mood_rating >= 1 and mood_rating <= 5),
    confidence_rating integer check (confidence_rating >= 1 and confidence_rating <= 5),
    highlights text[] not null default '{}',
    blockers text[] not null default '{}',
    action_items jsonb not null default '[]'::jsonb,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_checkins_plan on check_ins(plan_id);
create index idx_checkins_new_hire on check_ins(new_hire_id);
create index idx_checkins_date on check_ins(scheduled_date, status);

-- ============================================================
-- DOCUMENTS (company knowledge base)
-- ============================================================

create table documents (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    title text not null,
    description text,
    document_type document_type not null default 'other',
    file_url text,
    file_name text,
    file_size_bytes bigint,
    mime_type text,
    content_text text, -- extracted text for AI processing
    content_embedding vector(1536), -- for semantic search (requires pgvector)
    google_drive_id text,
    tags text[] not null default '{}',
    department text,
    applicable_roles uuid[] not null default '{}', -- role IDs this doc applies to
    is_required_reading boolean not null default false,
    uploaded_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_documents_org on documents(organization_id);
create index idx_documents_type on documents(organization_id, document_type);
create index idx_documents_tags on documents using gin(tags);

-- ============================================================
-- RAMP METRICS (time-series performance tracking)
-- ============================================================

create table ramp_metrics (
    id uuid primary key default uuid_generate_v4(),
    plan_id uuid not null references onboarding_plans(id) on delete cascade,
    new_hire_id uuid not null references users(id) on delete cascade,
    organization_id uuid not null references organizations(id) on delete cascade,
    recorded_date date not null default current_date,
    day_number integer not null,
    tasks_completed integer not null default 0,
    tasks_total integer not null default 0,
    completion_percentage numeric(5,2) not null default 0.00,
    on_track boolean not null default true,
    engagement_score numeric(5,2), -- derived from task feedback + check-in mood
    ai_summary text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(plan_id, recorded_date)
);

create index idx_metrics_plan on ramp_metrics(plan_id);
create index idx_metrics_org on ramp_metrics(organization_id);
create index idx_metrics_date on ramp_metrics(recorded_date);

-- ============================================================
-- INTEGRATION CONNECTIONS
-- ============================================================

create table integration_connections (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    provider integration_provider not null,
    is_active boolean not null default true,
    access_token text, -- encrypted in practice
    refresh_token text,
    token_expires_at timestamptz,
    webhook_url text,
    config jsonb not null default '{}'::jsonb,
    connected_by uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(organization_id, provider)
);

create index idx_integrations_org on integration_connections(organization_id);

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================

create table notifications (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    channel notification_channel not null,
    subject text not null,
    body text not null,
    metadata jsonb not null default '{}'::jsonb,
    sent_at timestamptz,
    read_at timestamptz,
    error text,
    created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications(user_id, created_at desc);
create index idx_notifications_unsent on notifications(sent_at) where sent_at is null;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table roles enable row level security;
alter table onboarding_templates enable row level security;
alter table template_tasks enable row level security;
alter table onboarding_plans enable row level security;
alter table plan_tasks enable row level security;
alter table task_completions enable row level security;
alter table check_ins enable row level security;
alter table documents enable row level security;
alter table ramp_metrics enable row level security;
alter table integration_connections enable row level security;
alter table notifications enable row level security;

-- Helper function: get user's organization
create or replace function get_user_org_id()
returns uuid as $$
    select organization_id from users where id = auth.uid();
$$ language sql security definer stable;

-- Helper function: get user's role
create or replace function get_user_role()
returns user_role as $$
    select role from users where id = auth.uid();
$$ language sql security definer stable;

-- Organizations: users can view their own org
create policy "Users can view own organization"
    on organizations for select
    using (id = get_user_org_id());

create policy "Owners can update organization"
    on organizations for update
    using (id = get_user_org_id() and get_user_role() = 'owner');

-- Users: can view colleagues in same org
create policy "Users can view org members"
    on users for select
    using (organization_id = get_user_org_id());

create policy "Users can update own profile"
    on users for update
    using (id = auth.uid());

create policy "Admins can manage users"
    on users for all
    using (organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin'));

-- Roles: org members can view, admins can manage
create policy "Org members can view roles"
    on roles for select
    using (organization_id = get_user_org_id());

create policy "Admins can manage roles"
    on roles for all
    using (organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin'));

-- Templates: org members can view, admins/managers can manage
create policy "Org members can view templates"
    on onboarding_templates for select
    using (organization_id = get_user_org_id());

create policy "Admins can manage templates"
    on onboarding_templates for all
    using (organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin', 'manager'));

-- Template tasks: inherit from template
create policy "Org members can view template tasks"
    on template_tasks for select
    using (template_id in (
        select id from onboarding_templates where organization_id = get_user_org_id()
    ));

create policy "Admins can manage template tasks"
    on template_tasks for all
    using (template_id in (
        select id from onboarding_templates
        where organization_id = get_user_org_id()
    ) and get_user_role() in ('owner', 'admin', 'manager'));

-- Onboarding plans: involved users can view, admins/managers can manage
create policy "Involved users can view plans"
    on onboarding_plans for select
    using (
        organization_id = get_user_org_id()
        and (
            get_user_role() in ('owner', 'admin', 'manager')
            or new_hire_id = auth.uid()
            or manager_id = auth.uid()
            or buddy_id = auth.uid()
        )
    );

create policy "Admins and managers can manage plans"
    on onboarding_plans for all
    using (organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin', 'manager'));

-- Plan tasks: involved users can view
create policy "Involved users can view plan tasks"
    on plan_tasks for select
    using (plan_id in (
        select id from onboarding_plans
        where organization_id = get_user_org_id()
        and (
            get_user_role() in ('owner', 'admin', 'manager')
            or new_hire_id = auth.uid()
            or manager_id = auth.uid()
            or buddy_id = auth.uid()
        )
    ));

create policy "Assigned users can update plan tasks"
    on plan_tasks for update
    using (assigned_to = auth.uid() or plan_id in (
        select id from onboarding_plans
        where manager_id = auth.uid() or (
            organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin')
        )
    ));

-- Task completions: users can insert their own, admins can view all
create policy "Users can insert own completions"
    on task_completions for insert
    with check (completed_by = auth.uid());

create policy "Involved users can view completions"
    on task_completions for select
    using (plan_id in (
        select id from onboarding_plans
        where organization_id = get_user_org_id()
    ));

-- Check-ins: involved users can view/update
create policy "Involved users can view check-ins"
    on check_ins for select
    using (new_hire_id = auth.uid() or interviewer_id = auth.uid() or plan_id in (
        select id from onboarding_plans
        where organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin')
    ));

create policy "Interviewers can update check-ins"
    on check_ins for update
    using (interviewer_id = auth.uid() or plan_id in (
        select id from onboarding_plans
        where organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin')
    ));

-- Documents: org members can view, admins can manage
create policy "Org members can view documents"
    on documents for select
    using (organization_id = get_user_org_id());

create policy "Admins can manage documents"
    on documents for all
    using (organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin', 'manager'));

-- Metrics: org members can view
create policy "Org members can view metrics"
    on ramp_metrics for select
    using (organization_id = get_user_org_id());

-- Integrations: admins only
create policy "Admins can manage integrations"
    on integration_connections for all
    using (organization_id = get_user_org_id() and get_user_role() in ('owner', 'admin'));

-- Notifications: users see own
create policy "Users can view own notifications"
    on notifications for select
    using (user_id = auth.uid());

create policy "Users can update own notifications"
    on notifications for update
    using (user_id = auth.uid());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_organizations_updated
    before update on organizations
    for each row execute function update_updated_at();

create trigger trg_users_updated
    before update on users
    for each row execute function update_updated_at();

create trigger trg_roles_updated
    before update on roles
    for each row execute function update_updated_at();

create trigger trg_templates_updated
    before update on onboarding_templates
    for each row execute function update_updated_at();

create trigger trg_template_tasks_updated
    before update on template_tasks
    for each row execute function update_updated_at();

create trigger trg_plans_updated
    before update on onboarding_plans
    for each row execute function update_updated_at();

create trigger trg_plan_tasks_updated
    before update on plan_tasks
    for each row execute function update_updated_at();

create trigger trg_checkins_updated
    before update on check_ins
    for each row execute function update_updated_at();

create trigger trg_documents_updated
    before update on documents
    for each row execute function update_updated_at();

create trigger trg_integrations_updated
    before update on integration_connections
    for each row execute function update_updated_at();

-- Recalculate plan completion when tasks change
create or replace function recalculate_plan_completion()
returns trigger as $$
declare
    v_plan_id uuid;
    v_total integer;
    v_completed integer;
    v_pct numeric(5,2);
begin
    v_plan_id := coalesce(new.plan_id, old.plan_id);

    select count(*), count(*) filter (where status = 'completed')
    into v_total, v_completed
    from plan_tasks
    where plan_id = v_plan_id and is_required = true;

    if v_total > 0 then
        v_pct := round((v_completed::numeric / v_total::numeric) * 100, 2);
    else
        v_pct := 0;
    end if;

    update onboarding_plans
    set completion_percentage = v_pct,
        status = case
            when v_pct >= 100 then 'completed'::onboarding_status
            else status
        end,
        actual_end_date = case
            when v_pct >= 100 then current_date
            else actual_end_date
        end
    where id = v_plan_id;

    return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger trg_plan_tasks_completion
    after update of status on plan_tasks
    for each row execute function recalculate_plan_completion();

-- Mark overdue tasks daily (to be called by cron)
create or replace function mark_overdue_tasks()
returns void as $$
begin
    update plan_tasks
    set status = 'overdue'
    where status in ('pending', 'in_progress')
    and due_date < current_date
    and plan_id in (
        select id from onboarding_plans where status = 'active'
    );
end;
$$ language plpgsql security definer;

-- Record daily metrics snapshot
create or replace function record_daily_metrics()
returns void as $$
begin
    insert into ramp_metrics (plan_id, new_hire_id, organization_id, recorded_date, day_number, tasks_completed, tasks_total, completion_percentage, on_track)
    select
        p.id,
        p.new_hire_id,
        p.organization_id,
        current_date,
        current_date - p.start_date + 1,
        count(*) filter (where pt.status = 'completed'),
        count(*),
        case when count(*) > 0
            then round((count(*) filter (where pt.status = 'completed')::numeric / count(*)::numeric) * 100, 2)
            else 0
        end,
        not exists(
            select 1 from plan_tasks
            where plan_id = p.id and status = 'overdue'
        )
    from onboarding_plans p
    join plan_tasks pt on pt.plan_id = p.id and pt.is_required = true
    where p.status = 'active'
    group by p.id, p.new_hire_id, p.organization_id, p.start_date
    on conflict (plan_id, recorded_date) do update set
        tasks_completed = excluded.tasks_completed,
        tasks_total = excluded.tasks_total,
        completion_percentage = excluded.completion_percentage,
        on_track = excluded.on_track;
end;
$$ language plpgsql security definer;

-- Handle new user registration
create or replace function handle_new_user()
returns trigger as $$
begin
    -- Create user profile if invited to an org
    -- The actual org assignment happens during the invite flow
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();
