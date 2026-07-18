import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LogOut, LayoutDashboard, QrCode, ClipboardList, User,
  Camera, Users, BarChart3, Settings, Calendar, LayoutGrid, Shield, UserCheck,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import zdspgcLogo from "@/assets/school-logo.jpg";
import { logout } from "@/lib/auth";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "student" | "admin";
  /** adminRole from session: "superadmin" | "officer" | undefined */
  adminRole?: string;
}

const studentLinks = [
  { to: "/student", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/student/qr", icon: QrCode, label: "My QR Code" },
  { to: "/student/attendance", icon: ClipboardList, label: "Attendance" },
  { to: "/student/profile", icon: User, label: "Profile" },
];

/** Full access — superadmin only */
const superadminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/scanner", icon: Camera, label: "Scanner" },
  { to: "/admin/events", icon: Calendar, label: "Events" },
  { to: "/admin/sections", icon: LayoutGrid, label: "Sections" },
  { to: "/admin/students", icon: Users, label: "Students" },
  { to: "/admin/reports", icon: BarChart3, label: "Reports" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

/** Restricted access — officer only */
const officerLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/scanner", icon: Camera, label: "Scanner" },
  { to: "/admin/events", icon: Calendar, label: "Events" },
  { to: "/admin/sections", icon: LayoutGrid, label: "Sections" },
];

const DashboardLayout = ({ children, role, adminRole }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Determine nav links based on role + adminRole
  let links = studentLinks;
  if (role === "admin") {
    links = adminRole === "officer" ? officerLinks : superadminLinks;
  }

  // Role badge for sidebar
  const isOfficer = role === "admin" && adminRole === "officer";
  const isSuperAdmin = role === "admin" && adminRole === "superadmin";

  const panelLabel = isOfficer
    ? "Officer Panel"
    : isSuperAdmin
    ? "Super Admin Panel"
    : role === "admin"
    ? "Admin Panel"
    : "Student Panel";

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 flex-col bg-primary text-primary-foreground">
        {/* Logo + panel name */}
        <div className="p-5 border-b border-navy-light">
          <Link to="/" className="flex items-center gap-3">
            <img src={zdspgcLogo} alt="ZDSPGC" className="h-10 w-10 rounded-full" />
            <div>
              <div className="text-gold font-bold text-sm">AttendWise</div>
              <div className="text-primary-foreground/60 text-xs">{panelLabel}</div>
            </div>
          </Link>
        </div>

        {/* Role badge (admin only) */}
        {role === "admin" && (
          <div className="px-4 pt-3">
            {isOfficer ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold">
                <UserCheck className="h-3 w-3" /> Officer Account
              </span>
            ) : isSuperAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/20 text-gold text-[11px] font-semibold">
                <Shield className="h-3 w-3" /> Super Admin
              </span>
            ) : null}
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-navy-light text-gold"
                    : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-navy-light/50"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Officer access note */}
        {isOfficer && (
          <div className="px-4 pb-2">
            <p className="text-[10px] text-primary-foreground/40 leading-relaxed">
              Officer accounts have limited access. Contact a Super Admin for Reports &amp; Settings.
            </p>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-navy-light">
          <Button
            variant="ghost"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-navy-light/50"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* ── Mobile ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Mobile top header */}
        <header className="md:hidden bg-primary p-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={zdspgcLogo} alt="ZDSPGC" className="h-8 w-8 rounded-full" />
            <div>
              <span className="text-gold font-bold text-sm">AttendWise</span>
              {isOfficer && (
                <span className="block text-[10px] text-blue-300 font-medium">Officer</span>
              )}
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="text-primary-foreground/70"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* Mobile bottom nav with kebab menu for overflow */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex">
          {links.length <= 4 ? (
            links.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium ${
                    active ? "text-gold" : "text-muted-foreground"
                  }`}
                >
                  <link.icon className="h-5 w-5 mb-0.5" />
                  {link.label}
                </Link>
              );
            })
          ) : (
            <>
              {/* Show first 3 links */}
              {links.slice(0, 3).map((link) => {
                const active = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium ${
                      active ? "text-gold" : "text-muted-foreground"
                    }`}
                  >
                    <link.icon className="h-5 w-5 mb-0.5" />
                    {link.label}
                  </Link>
                );
              })}
              {/* More / Kebab Menu trigger */}
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium ${
                  isMoreOpen ? "text-gold" : "text-muted-foreground"
                }`}
              >
                <MoreHorizontal className="h-5 w-5 mb-0.5" />
                More
              </button>
            </>
          )}
        </nav>

        {/* Kebab Slide-up Drawer */}
        {isMoreOpen && links.length > 4 && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsMoreOpen(false)}
            />
            {/* Slide-up panel */}
            <div className="md:hidden fixed bottom-[53px] left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-250">
              <div className="flex justify-between items-center pb-2.5 border-b border-border/60 mb-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Administration Panel Options</span>
                <button
                  onClick={() => setIsMoreOpen(false)}
                  className="text-xs font-semibold text-gold hover:underline"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {links.slice(3).map((link) => {
                  const active = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsMoreOpen(false)}
                      className={`flex flex-col items-center p-3 rounded-xl text-xs font-medium transition-colors ${
                        active
                          ? "bg-gold/10 text-gold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <link.icon className="h-5.5 w-5.5 mb-2" />
                      <span className="text-center truncate w-full text-[11px]">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
