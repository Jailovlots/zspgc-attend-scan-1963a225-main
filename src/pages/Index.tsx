import { Link } from "react-router-dom";
import { QrCode, BarChart3, Shield, Clock, Users, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import zdspgcLogo from "@/assets/school-logo.jpg";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  {
    icon: QrCode,
    title: "QR Code Generation",
    description: "Each student gets a unique, encrypted QR code for secure attendance tracking.",
  },
  {
    icon: Clock,
    title: "Real-Time Scanning",
    description: "Instant attendance recording with live camera QR scanning for administrators.",
  },
  {
    icon: BarChart3,
    title: "Interactive Reports",
    description: "Visual dashboards with charts, filters, and exportable attendance reports.",
  },
  {
    icon: Shield,
    title: "Secure & Encrypted",
    description: "JWT authentication, encrypted tokens, and role-based access control.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description: "Separate dashboards for students and administrators with protected routes.",
  },
  {
    icon: FileSpreadsheet,
    title: "CSV Export",
    description: "Export filtered attendance data to CSV for records and compliance.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm border-b border-navy-light">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={zdspgcLogo} alt="ZDSPGC Logo" className="h-10 w-10 rounded-full" />
            <div>
              <span className="text-gold font-bold text-lg font-sans tracking-tight">AttendWise</span>
              <span className="hidden sm:block text-primary-foreground/70 text-xs">ZDSPGC Attendance System</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-primary-foreground/80 hover:text-gold hover:bg-navy-light" asChild>
              <Link to="/login">Log In</Link>
            </Button>
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90 font-semibold" asChild>
              <Link to="/register">Register</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center gradient-hero overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/40 to-primary/90" />
        <div className="container mx-auto px-4 relative z-10 pt-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-gold/15 border border-gold/30 rounded-full px-4 py-1.5 mb-6 animate-fade-in">
              <QrCode className="h-4 w-4 text-gold" />
              <span className="text-gold text-sm font-medium">QR-Powered Attendance</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-primary-foreground leading-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Smart Attendance for BSIS{" "}
              <span className="text-gradient-gold">ZDSPGC-Dimataling Campus</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/75 mb-8 max-w-2xl animate-fade-in" style={{ animationDelay: "0.2s" }}>
              A secure, modern attendance monitoring system using encrypted QR codes.
              Track attendance in real-time with interactive dashboards and automated reports.
            </p>
            <div className="flex flex-wrap gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <Button size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90 font-semibold text-base px-8" asChild>
                <Link to="/register">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 text-base px-8" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Why AttendWise?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              A comprehensive attendance solution built for Zamboanga del Sur Provincial Government College.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group bg-card rounded-lg p-6 shadow-card hover:shadow-elevated transition-all duration-300 border border-border hover:border-gold/30 animate-fade-in"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="h-12 w-12 rounded-lg bg-gold/10 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-gold" />
                </div>
                <h3 className="text-lg font-semibold text-foreground font-sans mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src={zdspgcLogo} alt="ZDSPGC" className="h-8 w-8 rounded-full" />
            <span className="text-gold font-bold">AttendWise</span>
          </div>
          <p className="text-primary-foreground/60 text-sm">
            © 2025 Zamboanga del Sur Provincial Government College. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
