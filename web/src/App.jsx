import { useEffect, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  FileSignature,
  LogOut,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { clearSession, getSession, onUnauthorized, setSession } from '@/lib/api';
import { AttendancePage } from '@/pages/AttendancePage';
import { CatalogPage } from '@/pages/CatalogPage';
import { ContractsPage } from '@/pages/ContractsPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { LoginPage } from '@/pages/LoginPage';
import { SalariesPage } from '@/pages/SalariesPage';
import { StatisticsPage } from '@/pages/StatisticsPage';

const NAV_ITEMS = [
  { id: 'employees', label: 'Nhân viên', owner: 'TV1', icon: Users, component: EmployeesPage },
  {
    id: 'catalog',
    label: 'Phòng ban & Chức vụ',
    owner: 'TV1',
    icon: Building2,
    component: CatalogPage,
  },
  {
    id: 'contracts',
    label: 'Hợp đồng',
    owner: 'TV2',
    icon: FileSignature,
    component: ContractsPage,
  },
  {
    id: 'attendance',
    label: 'Chấm công',
    owner: 'TV2',
    icon: CalendarCheck2,
    component: AttendancePage,
  },
  { id: 'salaries', label: 'Lương', owner: 'TV3', icon: Wallet, component: SalariesPage },
  {
    id: 'statistics',
    label: 'Thống kê',
    owner: 'TV3',
    icon: BarChart3,
    component: StatisticsPage,
  },
];

export function App() {
  const [session, setAppSession] = useState(() => getSession());
  const [activeTab, setActiveTab] = useState(NAV_ITEMS[0].id);

  useEffect(() => {
    return onUnauthorized(() => {
      setAppSession(null);
    });
  }, []);

  if (!session) {
    return (
      <LoginPage
        onSuccess={(data) => {
          setSession(data);
          setAppSession(data);
        }}
      />
    );
  }

  const current = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];
  const ActiveComponent = current.component;

  function handleLogout() {
    clearSession();
    setAppSession(null);
  }

  return (
    <div className="min-h-screen flex bg-muted/20 text-foreground">
      <aside className="no-print sticky top-0 h-screen self-start w-64 shrink-0 border-r bg-sidebar p-4 flex flex-col justify-between">
        <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BriefcaseBusiness className="size-4" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">Quản lý nhân sự</div>
              <div className="text-[11px] text-muted-foreground">HRM System</div>
            </div>
          </div>

          <Separator />

          <nav className="space-y-1" aria-label="Điều hướng chính">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === current.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-xs'
                      : 'hover:bg-sidebar-accent text-sidebar-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 space-y-3 pt-3">
          <Separator />
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{session.user.ho_ten}</div>
              <div className="truncate text-xs text-muted-foreground">@{session.user.username}</div>
            </div>
            <Badge variant={session.user.vai_tro === 'Admin' ? 'default' : 'secondary'}>
              {session.user.vai_tro}
            </Badge>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            <LogOut className="size-3.5" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <ActiveComponent user={session.user} />
        </div>
      </main>
    </div>
  );
}

export default App;
