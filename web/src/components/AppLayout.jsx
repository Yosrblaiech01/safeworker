import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Cpu,
  FileText,
  HardHat,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { initialsOf } from '../utils/metrics';

/**
 * Mise en page commune : barre latérale + zone principale.
 */
export default function AppLayout({ children, stats, alertCount = 0, loading = false }) {
  const { user, logout } = useAuth();
  const { isLight, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell flex h-screen w-full overflow-hidden font-sans">
      <aside className="sidebar relative z-30 flex w-64 shrink-0 flex-col justify-between overflow-hidden print:hidden">
        <div className="pointer-events-none absolute -left-20 top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />

        <div>
          <div className="relative flex items-center gap-3 border-b border-slate-500/10 p-5">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-[#111827] shadow-[0_0_28px_rgba(245,158,11,0.3)]">
              <HardHat className="h-6 w-6" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0a0d11] bg-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-black leading-tight tracking-[0.16em] text-white">SAFE WORKER</h1>
              <p className="mt-1 text-[9px] font-semibold tracking-[0.28em] text-amber-400/80">INDUSTRIAL MONITOR</p>
            </div>
          </div>
          <div className="hazard-stripe h-1 w-full opacity-70" />

          <nav className="mt-6 space-y-1.5 px-4">
            <NavItem to="/dashboard" icon={<LayoutDashboard />} label="Tableau de bord" />
            <NavItem to="/workers" icon={<Users />} label="Travailleurs" />
            <NavItem to="/alerts" icon={<Bell />} label="Alertes" badge={alertCount} />
            <NavItem to="/reports" icon={<FileText />} label="Rapports" />
            <NavItem to="/settings" icon={<Cpu />} label="Capteurs" />
          </nav>
        </div>

        <div className="relative p-4">
          {stats && (
            <div className="panel-soft mb-5 rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Bracelets connectés</p>
                <Cpu className="h-4 w-4 text-amber-400" />
              </div>
              <StatRow label="En ligne" value={stats.onlineDevices} active={stats.onlineDevices > 0} />
              <StatRow label="Assignés" value={stats.devices} active={stats.devices > 0} />
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="btn-ghost flex w-full items-center justify-between rounded-2xl p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-xs font-black text-[#111827]">
                  {initialsOf(user?.name)}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.role}</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-500 transition ${showMenu ? 'rotate-180' : ''}`} />
            </button>

            {showMenu && (
              <div className="panel absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-300 transition hover:bg-amber-400/10"
                >
                  {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {isLight ? 'Mode sombre' : 'Mode clair'}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 transition hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="app-main relative min-w-0 flex-1 overflow-y-auto p-6 lg:p-8 print:overflow-visible print:p-0">
        <div className="blueprint-grid pointer-events-none absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden">
            <div className="h-11 w-11 animate-spin rounded-full border-2 border-amber-400 border-t-transparent shadow-[0_0_24px_rgba(245,158,11,0.25)]" />
          </div>
        )}

        <div className="relative mx-auto max-w-[1550px]">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `nav-item group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-200 ${isActive ? 'active' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute bottom-2.5 left-0 top-2.5 w-1 rounded-r-full bg-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.9)]" />
          )}
          <span
            className={`h-5 w-5 shrink-0 [&>svg]:h-5 [&>svg]:w-5 ${isActive ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-300'}`}
          >
            {icon}
          </span>
          <span className="font-semibold">{label}</span>
          {badge > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function StatRow({ label, value, active }) {
  return (
    <div className="mt-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`}
        />
        <span className="text-slate-400">{label}</span>
      </div>
      <span className="font-black text-white">{value || 0}</span>
    </div>
  );
}
