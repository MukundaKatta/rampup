import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, Users, Mail } from "lucide-react";
import { getInitials, formatDate } from "@/lib/utils";
import { InviteDialog } from "@/components/team/invite-dialog";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", authUser.id)
    .single();

  if (!currentUser) redirect("/login");

  const { data: members } = await supabase
    .from("users")
    .select("*, manager:users!users_manager_id_fkey(full_name)")
    .eq("organization_id", currentUser.organization_id)
    .order("full_name");

  const { data: roles } = await supabase
    .from("roles")
    .select("*")
    .eq("organization_id", currentUser.organization_id)
    .eq("is_active", true)
    .order("title");

  const departments = Array.from(new Set((members || []).map((m) => m.department).filter(Boolean)));

  const roleColors: Record<string, string> = {
    owner: "bg-purple-100 text-purple-800",
    admin: "bg-blue-100 text-blue-800",
    manager: "bg-green-100 text-green-800",
    member: "bg-gray-100 text-gray-800",
    new_hire: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">
            {members?.length || 0} members across {departments.length} departments
          </p>
        </div>
        <InviteDialog />
      </div>

      {/* Members Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(members || []).map((member) => {
          const managerData = member.manager as unknown as { full_name: string } | null;
          return (
            <Card key={member.id} className="transition-colors hover:bg-muted/50">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{member.full_name}</h3>
                      {!member.is_active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {member.job_title || "No title"} &middot; {member.department || "No department"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className={roleColors[member.role] || "bg-gray-100 text-gray-800"} variant="outline">
                        {member.role}
                      </Badge>
                      {member.start_date && (
                        <span className="text-xs text-muted-foreground">
                          Joined {formatDate(member.start_date)}
                        </span>
                      )}
                    </div>
                    {managerData && (
                      <p className="text-xs text-muted-foreground">
                        Reports to: {managerData.full_name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Roles Section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Defined Roles</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(roles || []).map((role) => (
            <Card key={role.id}>
              <CardContent className="p-5">
                <h3 className="font-semibold">{role.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {role.department} {role.level ? `/ ${role.level}` : ""}
                </p>
                {role.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {role.description}
                  </p>
                )}
                {role.required_skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {role.required_skills.slice(0, 4).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {role.required_skills.length > 4 && (
                      <span className="text-xs text-muted-foreground">
                        +{role.required_skills.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
