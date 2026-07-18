import { ReactNode, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LogOut, LayoutDashboard, QrCode, ClipboardList, User,
  Camera, Users, BarChart3, Settings, Calendar, LayoutGrid, Shield, UserCheck,
  Menu, X,
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  const handleLinkClick = () => setIsDrawerOpen(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Shared nav link list (used in both desktop sidebar and mobile drawer)
  const NavLinks = ({ onClose }: { onClose?: () => void }) => (
    <>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-navy-light text-gold"
                  : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-navy-light/50"
              }`}
            >
              <link.icon className="h-4 w-4 shrink-0" />
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
          onClick={handleLogout}
          className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-navy-light/50"
        >
          <LogOut className="h-4 w-4 mr-3" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
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

        <NavLinks />
      </aside>

      {/* ── Mobile Layout ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top header with hamburger */}
        <header className="md:hidden bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
          {/* Hamburger button — LEFT side */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-navy-light/50 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Title — center */}
          <div className="flex items-center gap-2">
            <img src={zdspgcLogo} alt="ZDSPGC" className="h-7 w-7 rounded-full" />
            <div>
              <span className="text-gold font-bold text-sm leading-none">AttendWise</span>
              {isOfficer && (
                <span className="block text-[10px] text-blue-300 font-medium leading-none mt-0.5">Officer</span>
              )}
              {isSuperAdmin && (
                <span className="block text-[10px] text-gold/70 font-medium leading-none mt-0.5">Super Admin</span>
              )}
            </div>
          </div>

          {/* Logout button — RIGHT side */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-navy-light/50 transition-colors text-primary-foreground/70 hover:text-primary-foreground"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {/* ── Mobile Left-Side Drawer Overlay ───────────────────── */}
        {isDrawerOpen && (
          <>
            {/* Dark backdrop — tap to close */}
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsDrawerOpen(false)}
            />

            {/* Left drawer panel */}
            <div
              className="md:hidden fixed top-0 left-0 h-full w-72 z-50 bg-primary text-primary-foreground flex flex-col shadow-2xl"
              style={{ animation: "slideInLeft 0.22s ease-out" }}
            >
              {/* Drawer header */}
              <div className="p-4 border-b border-navy-light flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={zdspgcLogo} alt="ZDSPGC" className="h-9 w-9 rounded-full" />
                  <div>
                    <div className="text-gold font-bold text-sm leading-none">AttendWise</div>
                    <div className="text-primary-foreground/60 text-xs mt-0.5">{panelLabel}</div>
                  </div>
                </div>
                {/* Close button */}
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-navy-light/50 transition-colors text-primary-foreground/70 hover:text-primary-foreground"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Role badge inside drawer */}
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

              {/* Navigation links */}
              <NavLinks onClose={handleLinkClick} />
            </div>
          </>
        )}

        {/* Slide-in animation keyframe */}
        <style>{`
          @keyframes slideInLeft {
            from { transform: translateX(-100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Page content — no bottom padding needed since no bottom nav */}
        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
