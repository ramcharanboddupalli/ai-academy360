import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Users, FolderKanban, Wallet, CircleAlert, BarChart3, Sparkles, Settings, GraduationCap, Bell, BrainCircuit } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { NotificationBell } from '../components/NotificationBell';

const items = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Students', href: '/admin/students', icon: Users },
  { label: 'Courses', href: '/admin/courses', icon: FolderKanban },
  { label: 'Payments', href: '/admin/payments', icon: Wallet },
  { label: 'Academics & Services', href: '/admin/management?tab=learning', icon: GraduationCap },
  { label: 'Complaints', href: '/admin/complaints', icon: CircleAlert },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'AI Insights', href: '/admin/ai-insights', icon: Sparkles },
  { label: 'AI Copilot', href: '/admin/ai-copilot', icon: BrainCircuit },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar items={items} title="Admin Portal" />
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-[#063B2D]/40 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="w-72 bg-[var(--color-green)]" onClick={(event) => event.stopPropagation()}>
              <Sidebar items={items} title="Admin Portal" isMobile onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-4 py-4 md:px-6">
            <button type="button" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-text)]">Admin Center</span>
            </div>
            <div className="flex items-center gap-2"><NotificationBell role="ADMIN" /><button type="button" className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button></div>
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
