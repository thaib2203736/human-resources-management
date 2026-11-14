import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clearSession, getSession, setSession } from '@/lib/api';
import { LoginPage } from '@/pages/LoginPage';

// Các thành viên thay thế component tương ứng vào trường `render`
const NAV_ITEMS = [
  { id: 'employees', label: 'Nhân viên', owner: 'TV1' },
  { id: 'catalog', label: 'Phòng ban & Chức vụ', owner: 'TV1' },
  { id: 'contracts', label: 'Hợp đồng', owner: 'TV2' },
  { id: 'attendance', label: 'Chấm công', owner: 'TV2' },
  { id: 'salaries', label: 'Lương', owner: 'TV3' },
  { id: 'statistics', label: 'Thống kê', owner: 'TV3' },
];

export function App() {
  const [session, setAppSession] = useState(() => getSession());
  const [activeTab, setActiveTab] = useState(NAV_ITEMS[0].id);

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

  function handleLogout() {
    clearSession();
    setAppSession(null);
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="no-print w-56 border-r bg-sidebar p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="font-semibold text-base px-2">Quản lý nhân sự</div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                  item.id === current.id
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'hover:bg-sidebar-accent text-sidebar-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="text-xs text-muted-foreground px-2">
            {session.user.ho_ten} ({session.user.vai_tro})
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            Đăng xuất
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Khu vực module <strong>{current.label}</strong> (phụ trách: {current.owner})
        </div>
      </main>
    </div>
  );
}

export default App;
