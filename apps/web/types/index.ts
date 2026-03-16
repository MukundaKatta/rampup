import type { Database } from "@rampup/supabase";

// Table row types
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type OnboardingTemplate = Database["public"]["Tables"]["onboarding_templates"]["Row"];
export type TemplateTask = Database["public"]["Tables"]["template_tasks"]["Row"];
export type OnboardingPlan = Database["public"]["Tables"]["onboarding_plans"]["Row"];
export type PlanTask = Database["public"]["Tables"]["plan_tasks"]["Row"];
export type TaskCompletion = Database["public"]["Tables"]["task_completions"]["Row"];
export type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type RampMetric = Database["public"]["Tables"]["ramp_metrics"]["Row"];
export type IntegrationConnection = Database["public"]["Tables"]["integration_connections"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

// Insert types
export type OrganizationInsert = Database["public"]["Tables"]["organizations"]["Insert"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type RoleInsert = Database["public"]["Tables"]["roles"]["Insert"];
export type OnboardingTemplateInsert = Database["public"]["Tables"]["onboarding_templates"]["Insert"];
export type TemplateTaskInsert = Database["public"]["Tables"]["template_tasks"]["Insert"];
export type OnboardingPlanInsert = Database["public"]["Tables"]["onboarding_plans"]["Insert"];
export type PlanTaskInsert = Database["public"]["Tables"]["plan_tasks"]["Insert"];
export type CheckInInsert = Database["public"]["Tables"]["check_ins"]["Insert"];
export type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];

// Extended types with relations
export type OnboardingPlanWithRelations = OnboardingPlan & {
  new_hire: User;
  manager: User;
  buddy?: User | null;
  role?: Role | null;
  template?: OnboardingTemplate | null;
};

export type PlanTaskWithRelations = PlanTask & {
  plan?: OnboardingPlan;
  assigned_user?: User | null;
};

export type CheckInWithRelations = CheckIn & {
  plan: OnboardingPlan;
  new_hire: User;
  interviewer: User;
};

// Dashboard stats
export interface DashboardStats {
  activeOnboardings: number;
  completedThisMonth: number;
  averageCompletion: number;
  overdueTaskCount: number;
  upcomingCheckIns: number;
  totalTeamMembers: number;
}

// Analytics types
export interface CompletionTrend {
  date: string;
  completionRate: number;
  activePlans: number;
}

export interface DepartmentMetrics {
  department: string;
  activeCount: number;
  avgCompletion: number;
  avgDaysToComplete: number;
}
