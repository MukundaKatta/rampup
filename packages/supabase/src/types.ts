export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubscriptionTier = "free" | "starter" | "professional" | "enterprise";
export type UserRole = "owner" | "admin" | "manager" | "member" | "new_hire";
export type OnboardingStatus = "draft" | "scheduled" | "active" | "paused" | "completed" | "cancelled";
export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped" | "overdue";
export type TaskType = "reading" | "meeting" | "setup" | "training" | "project" | "social" | "review" | "custom";
export type CheckInStatus = "scheduled" | "completed" | "missed" | "rescheduled";
export type DocumentType = "handbook" | "wiki" | "process" | "training" | "policy" | "other";
export type IntegrationProvider = "slack" | "google_calendar" | "google_drive" | "sendgrid";
export type NotificationChannel = "email" | "slack" | "in_app";

export interface OrgSettings {
  timezone: string;
  working_days: number[];
  daily_nudge_time: string;
  weekly_digest_day: number;
  auto_schedule_checkins: boolean;
  default_plan_duration_days: number;
}

export interface PlanPhase {
  name: string;
  start_day: number;
  end_day: number;
  description: string;
}

export interface Resource {
  url: string;
  title: string;
  type: string;
}

export interface ActionItem {
  text: string;
  assignee: string;
  due_date?: string;
  completed: boolean;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          domain: string | null;
          subscription_tier: SubscriptionTier;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          max_active_onboardings: number;
          settings: OrgSettings;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          domain?: string | null;
          subscription_tier?: SubscriptionTier;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          max_active_onboardings?: number;
          settings?: OrgSettings;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          domain?: string | null;
          subscription_tier?: SubscriptionTier;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          max_active_onboardings?: number;
          settings?: OrgSettings;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: UserRole;
          department: string | null;
          job_title: string | null;
          manager_id: string | null;
          slack_user_id: string | null;
          google_calendar_id: string | null;
          timezone: string;
          start_date: string | null;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role?: UserRole;
          department?: string | null;
          job_title?: string | null;
          manager_id?: string | null;
          slack_user_id?: string | null;
          google_calendar_id?: string | null;
          timezone?: string;
          start_date?: string | null;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          department?: string | null;
          job_title?: string | null;
          manager_id?: string | null;
          slack_user_id?: string | null;
          google_calendar_id?: string | null;
          timezone?: string;
          start_date?: string | null;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          department: string;
          description: string | null;
          level: string | null;
          required_skills: string[];
          tools_and_access: string[];
          key_stakeholders: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          department: string;
          description?: string | null;
          level?: string | null;
          required_skills?: string[];
          tools_and_access?: string[];
          key_stakeholders?: string[];
          is_active?: boolean;
        };
        Update: {
          title?: string;
          department?: string;
          description?: string | null;
          level?: string | null;
          required_skills?: string[];
          tools_and_access?: string[];
          key_stakeholders?: string[];
          is_active?: boolean;
        };
      };
      onboarding_templates: {
        Row: {
          id: string;
          organization_id: string;
          role_id: string | null;
          name: string;
          description: string | null;
          duration_days: number;
          is_default: boolean;
          phases: PlanPhase[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          role_id?: string | null;
          name: string;
          description?: string | null;
          duration_days?: number;
          is_default?: boolean;
          phases?: PlanPhase[];
          created_by?: string | null;
        };
        Update: {
          role_id?: string | null;
          name?: string;
          description?: string | null;
          duration_days?: number;
          is_default?: boolean;
          phases?: PlanPhase[];
        };
      };
      template_tasks: {
        Row: {
          id: string;
          template_id: string;
          title: string;
          description: string | null;
          task_type: TaskType;
          day_offset: number;
          duration_minutes: number | null;
          is_required: boolean;
          dependencies: string[];
          resources: Resource[];
          assignee_role: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          title: string;
          description?: string | null;
          task_type?: TaskType;
          day_offset: number;
          duration_minutes?: number | null;
          is_required?: boolean;
          dependencies?: string[];
          resources?: Resource[];
          assignee_role?: string | null;
          sort_order?: number;
        };
        Update: {
          title?: string;
          description?: string | null;
          task_type?: TaskType;
          day_offset?: number;
          duration_minutes?: number | null;
          is_required?: boolean;
          dependencies?: string[];
          resources?: Resource[];
          assignee_role?: string | null;
          sort_order?: number;
        };
      };
      onboarding_plans: {
        Row: {
          id: string;
          organization_id: string;
          template_id: string | null;
          new_hire_id: string;
          manager_id: string;
          buddy_id: string | null;
          role_id: string | null;
          title: string;
          status: OnboardingStatus;
          start_date: string;
          target_end_date: string;
          actual_end_date: string | null;
          ai_generated: boolean;
          ai_generation_context: Json | null;
          phases: PlanPhase[];
          completion_percentage: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          template_id?: string | null;
          new_hire_id: string;
          manager_id: string;
          buddy_id?: string | null;
          role_id?: string | null;
          title: string;
          status?: OnboardingStatus;
          start_date: string;
          target_end_date: string;
          actual_end_date?: string | null;
          ai_generated?: boolean;
          ai_generation_context?: Json | null;
          phases?: PlanPhase[];
          completion_percentage?: number;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          template_id?: string | null;
          manager_id?: string;
          buddy_id?: string | null;
          title?: string;
          status?: OnboardingStatus;
          start_date?: string;
          target_end_date?: string;
          actual_end_date?: string | null;
          ai_generated?: boolean;
          ai_generation_context?: Json | null;
          phases?: PlanPhase[];
          completion_percentage?: number;
          notes?: string | null;
        };
      };
      plan_tasks: {
        Row: {
          id: string;
          plan_id: string;
          template_task_id: string | null;
          title: string;
          description: string | null;
          task_type: TaskType;
          status: TaskStatus;
          assigned_to: string | null;
          due_date: string;
          completed_at: string | null;
          completed_by: string | null;
          is_required: boolean;
          is_ai_generated: boolean;
          dependencies: string[];
          resources: Resource[];
          duration_minutes: number | null;
          sort_order: number;
          phase_name: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          template_task_id?: string | null;
          title: string;
          description?: string | null;
          task_type?: TaskType;
          status?: TaskStatus;
          assigned_to?: string | null;
          due_date: string;
          completed_at?: string | null;
          completed_by?: string | null;
          is_required?: boolean;
          is_ai_generated?: boolean;
          dependencies?: string[];
          resources?: Resource[];
          duration_minutes?: number | null;
          sort_order?: number;
          phase_name?: string | null;
          notes?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          task_type?: TaskType;
          status?: TaskStatus;
          assigned_to?: string | null;
          due_date?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          is_required?: boolean;
          dependencies?: string[];
          resources?: Resource[];
          duration_minutes?: number | null;
          sort_order?: number;
          phase_name?: string | null;
          notes?: string | null;
        };
      };
      task_completions: {
        Row: {
          id: string;
          task_id: string;
          plan_id: string;
          completed_by: string;
          rating: number | null;
          feedback: string | null;
          time_spent_minutes: number | null;
          completed_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          plan_id: string;
          completed_by: string;
          rating?: number | null;
          feedback?: string | null;
          time_spent_minutes?: number | null;
          completed_at?: string;
        };
        Update: {
          rating?: number | null;
          feedback?: string | null;
          time_spent_minutes?: number | null;
        };
      };
      check_ins: {
        Row: {
          id: string;
          plan_id: string;
          new_hire_id: string;
          interviewer_id: string;
          scheduled_date: string;
          scheduled_time: string | null;
          status: CheckInStatus;
          check_in_day: number;
          calendar_event_id: string | null;
          ai_suggested_questions: string[];
          notes: string | null;
          mood_rating: number | null;
          confidence_rating: number | null;
          highlights: string[];
          blockers: string[];
          action_items: ActionItem[];
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          new_hire_id: string;
          interviewer_id: string;
          scheduled_date: string;
          scheduled_time?: string | null;
          status?: CheckInStatus;
          check_in_day: number;
          calendar_event_id?: string | null;
          ai_suggested_questions?: string[];
          notes?: string | null;
          mood_rating?: number | null;
          confidence_rating?: number | null;
          highlights?: string[];
          blockers?: string[];
          action_items?: ActionItem[];
        };
        Update: {
          scheduled_date?: string;
          scheduled_time?: string | null;
          status?: CheckInStatus;
          calendar_event_id?: string | null;
          ai_suggested_questions?: string[];
          notes?: string | null;
          mood_rating?: number | null;
          confidence_rating?: number | null;
          highlights?: string[];
          blockers?: string[];
          action_items?: ActionItem[];
          completed_at?: string | null;
        };
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          document_type: DocumentType;
          file_url: string | null;
          file_name: string | null;
          file_size_bytes: number | null;
          mime_type: string | null;
          content_text: string | null;
          google_drive_id: string | null;
          tags: string[];
          department: string | null;
          applicable_roles: string[];
          is_required_reading: boolean;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          document_type?: DocumentType;
          file_url?: string | null;
          file_name?: string | null;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          content_text?: string | null;
          google_drive_id?: string | null;
          tags?: string[];
          department?: string | null;
          applicable_roles?: string[];
          is_required_reading?: boolean;
          uploaded_by?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          document_type?: DocumentType;
          file_url?: string | null;
          file_name?: string | null;
          content_text?: string | null;
          tags?: string[];
          department?: string | null;
          applicable_roles?: string[];
          is_required_reading?: boolean;
        };
      };
      ramp_metrics: {
        Row: {
          id: string;
          plan_id: string;
          new_hire_id: string;
          organization_id: string;
          recorded_date: string;
          day_number: number;
          tasks_completed: number;
          tasks_total: number;
          completion_percentage: number;
          on_track: boolean;
          engagement_score: number | null;
          ai_summary: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          new_hire_id: string;
          organization_id: string;
          recorded_date?: string;
          day_number: number;
          tasks_completed?: number;
          tasks_total?: number;
          completion_percentage?: number;
          on_track?: boolean;
          engagement_score?: number | null;
          ai_summary?: string | null;
          metadata?: Json;
        };
        Update: {
          tasks_completed?: number;
          tasks_total?: number;
          completion_percentage?: number;
          on_track?: boolean;
          engagement_score?: number | null;
          ai_summary?: string | null;
          metadata?: Json;
        };
      };
      integration_connections: {
        Row: {
          id: string;
          organization_id: string;
          provider: IntegrationProvider;
          is_active: boolean;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          webhook_url: string | null;
          config: Json;
          connected_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          provider: IntegrationProvider;
          is_active?: boolean;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          webhook_url?: string | null;
          config?: Json;
          connected_by?: string | null;
        };
        Update: {
          is_active?: boolean;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          webhook_url?: string | null;
          config?: Json;
        };
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          channel: NotificationChannel;
          subject: string;
          body: string;
          metadata: Json;
          sent_at: string | null;
          read_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          channel: NotificationChannel;
          subject: string;
          body: string;
          metadata?: Json;
          sent_at?: string | null;
          error?: string | null;
        };
        Update: {
          sent_at?: string | null;
          read_at?: string | null;
          error?: string | null;
        };
      };
    };
  };
}
