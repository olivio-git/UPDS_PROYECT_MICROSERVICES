import { Badge } from "@/components/keel/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/keel/item";
import { MainLayout, Page, PageHeader } from "@/components/layout";
import { useAuthStore } from "@/modules/auth/services/authStore";
import { menuForRole } from "@/navigation/menu";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  teacher: "Docente",
  proctor: "Supervisor",
  student: "Estudiante",
};

/**
 * Home for staff roles. It used to be a centred hero ("¡Bienvenido!") with a
 * single button; now it is a full-width index of what this role can open,
 * grouped the same way as the sidebar so both read as one map of the app.
 */
const DashboardScreen = () => {
  const { user } = useAuthStore();
  const groups = useMemo(
    () =>
      menuForRole(user?.role)
        .map((group) => ({ ...group, items: group.items.filter((item) => item.path !== "/dashboard") }))
        .filter((group) => group.items.length > 0),
    [user?.role],
  );

  return (
    <MainLayout>
      <Page>
        <PageHeader
          title={`Hola, ${user?.firstName ?? ""}`.trim()}
          description="Accesos a todo lo que puedes gestionar desde tu cuenta"
          meta={user?.role && <Badge variant="secondary">{ROLE_LABEL[user.role] ?? user.role}</Badge>}
        />

        <div className="flex flex-col gap-4">
          {groups.map((group, i) => (
            <section key={group.label ?? `group-${i}`} className="flex flex-col gap-2">
              {group.label && (
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</h2>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.items.map(({ path, label, hint, icon: Icon }) => (
                  <Item key={path} variant="outline" render={<Link to={path} />}>
                    <ItemMedia variant="icon">
                      <Icon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{label}</ItemTitle>
                      {hint && <ItemDescription>{hint}</ItemDescription>}
                    </ItemContent>
                    <ItemActions>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </ItemActions>
                  </Item>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Page>
    </MainLayout>
  );
};

export default DashboardScreen;
