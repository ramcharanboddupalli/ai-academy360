import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, CalendarDays, Wallet, Award, BriefcaseBusiness, MessageSquareText, CircleAlert, UserRound, FolderKanban, Users, BarChart3, Sparkles, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: SidebarItem[];
  title: string;
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ items, title, isMobile = false, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout, isLoading } = useAuth();
  const generalItems = [
    { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Courses', href: '/student/courses', icon: GraduationCap },
    { label: 'Schedule', href: '/student/schedule', icon: CalendarDays },
    { label: 'Payments', href: '/student/payments', icon: Wallet },
    { label: 'Certificates', href: '/student/certificates', icon: Award },
    { label: 'Internships', href: '/student/internships', icon: BriefcaseBusiness },
    { label: 'AI Support', href: '/student/support', icon: Sparkles },
    { label: 'My Complaints', href: '/student/complaints', icon: CircleAlert },
    { label: 'Profile', href: '/student/profile', icon: UserRound },
  ];

  const adminItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Students', href: '/admin/students', icon: Users },
    { label: 'Courses', href: '/admin/courses', icon: FolderKanban },
    { label: 'Payments', href: '/admin/payments', icon: Wallet },
    { label: 'Complaints', href: '/admin/complaints', icon: MessageSquareText },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { label: 'AI Insights', href: '/admin/ai-insights', icon: Sparkles },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const resolvedItems = items.length ? items : title.toLowerCase().includes('admin') ? adminItems : generalItems;
  const initials = user?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className={`${isMobile ? 'w-full' : 'w-72'} border-r border-[var(--color-border)] bg-[var(--color-green)] text-[var(--color-card)]`}>
      <div className="flex items-center justify-between border-b border-[var(--color-card)]/10 px-5 py-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-card)]/75">AI Academy</div>
          <div className="mt-2 text-lg font-semibold">{title}</div>
          <p className="mt-1 text-xs text-[var(--color-card)]/70">Learn. Grow. Resolve.</p>
        </div>
      </div>

      <nav className="space-y-1 p-3">
        {resolvedItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-[var(--color-card)] shadow-[0_8px_18px_rgba(252,108,38,0.20)]'
                    : 'text-[var(--color-card)]/75 hover:bg-[var(--color-card)]/5 hover:text-[var(--color-card)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[var(--color-card)]' : 'text-[var(--color-card)]/80'}`} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-[var(--color-card)]/10 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-[var(--color-card)]/5 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-card)]">{initials}</div>
          <div>
            <div className="text-sm font-medium text-[var(--color-card)]">{user?.name}</div>
            <div className="text-[11px] text-[var(--color-card)]/70">{user?.studentId ?? (user?.role === 'ADMIN' ? 'Management account' : 'Student account')}</div>
          </div>
        </div>
        <button type="button" onClick={handleLogout} disabled={isLoading} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--color-card)]/75 transition hover:bg-[var(--color-card)]/5 hover:text-[var(--color-card)] disabled:opacity-60">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
