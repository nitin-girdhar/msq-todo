import { redirect } from 'next/navigation';
import { NotificationProvider, productOrigins, authOrigin, adminWebOrigin, adminOrigin, usableProducts, landingFor } from '@platform/ui-kit';
import { AppShell } from '@platform/ui-kit/shell';
import { requireSession, getEnabledModules } from '@platform/ui-kit/server';
import { TaskNavBadges } from '@task/web';
import { MOBILE_TABS, TASK_NAV } from '@/src/config/navigation';

interface Props {
  children: React.ReactNode;
}

// Authenticated Task chrome (todo.app.com). Same session gating + shared
// navbar/sidebar as the other product apps, plus a check that the tenant has
// the `tasks` module enabled AND that this user can actually use the `task`
// product.
export default async function TaskModuleShell({ children }: Props) {
  const { session, cookieHeader, licensedProducts } = await requireSession('/tasks');
  const enabledModules = await getEnabledModules(cookieHeader);
  const origins = productOrigins();
  const usable = usableProducts(licensedProducts, session);

  if (!enabledModules.includes('tasks') || !usable.includes('task')) {
    // Send them to a product they CAN use — never a hardcoded LMS, which a
    // tenant without it would just get 403'd on. See HrModuleShell for the
    // same reasoning.
    const elsewhere = landingFor(
      usable.filter((p) => p !== 'task'),
      origins,
    );
    if (elsewhere) redirect(elsewhere);
    const auth = authOrigin();
    redirect(auth ? `${auth}/no-access` : '/no-access');
  }

  return (
    <NotificationProvider>
      <TaskNavBadges actor={session}>
        <AppShell
          nav={TASK_NAV}
          mobileTabs={MOBILE_TABS}
          productLine="Tasks"
          productKey="task"
          user={session}
          licensedProducts={licensedProducts}
          productOrigins={origins}
          activeProduct="task"
          homeHref="/tasks"
          title="Tasks"
          titleWithBrand
          adminWebUrl={adminWebOrigin()}
          lookupAdminUrl={adminOrigin()}
        >
          {children}
        </AppShell>
      </TaskNavBadges>
    </NotificationProvider>
  );
}
