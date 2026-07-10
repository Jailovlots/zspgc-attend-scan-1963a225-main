import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import bsisLogo from "@/assets/bsis-logo.png";
import { loginUser } from "@/lib/auth";
import { API_URL } from "@/lib/config";

const Login = () => {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"student" | "admin">("student");
  const [isLoading, setIsLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if the backend server is reachable on mount
  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`);
        setServerOnline(res.ok);
      } catch {
        setServerOnline(false);
      }
    };
    checkServer();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (serverOnline === false) {
      toast({
        title: "Server Offline",
        description: "The backend server is not running. Start it with: npm run dev",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginUser(loginId, password, role);

      if (user && user.role === role) {
        toast({ title: "Login successful!", description: `Welcome back, ${user.firstName}!` });
        navigate(role === "admin" ? "/admin" : "/student");
      } else if (user && user.role !== role) {
        toast({
          title: "Wrong role selected",
          description: `This account belongs to role "${user.role}". Please select the correct tab.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Login failed",
          description: "Incorrect email or password. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      if (error?.message === "NETWORK_ERROR") {
        setServerOnline(false);
        toast({
          title: "Cannot reach server",
          description: "The backend server is offline. Run: npm run dev",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Server Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4">
            <img src={bsisLogo} alt="BSIS Logo" className="h-14 w-14 rounded-full object-cover" />
          </Link>
          <h1 className="text-2xl font-display font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to AttendWise</p>

          {/* Server status badge */}
          <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-medium ${
            serverOnline === null
              ? "bg-muted text-muted-foreground"
              : serverOnline
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {serverOnline === null ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse inline-block" /> Checking server…</>
            ) : serverOnline ? (
              <><Wifi className="h-3 w-3" /> Server online</>
            ) : (
              <><WifiOff className="h-3 w-3" /> Server offline — run: npm run dev</>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-elevated p-8">
          {/* Role Toggle */}
          <div className="flex bg-muted rounded-lg p-1 mb-6">
            {(["student", "admin"] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(r);
                  setLoginId("");
                }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                  role === r
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "student" ? "🎓 Student" : "🛡️ Admin"}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="loginId" className="text-foreground">Email Address</Label>
              <Input
                id="loginId"
                type="email"
                placeholder={role === "admin" ? "admin@zdspgc.edu.ph" : "student@zdspgc.edu.ph"}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading || serverOnline === false}
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90 font-semibold"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          {/* Admin credentials hint */}
          {role === "admin" && (
            <p className="text-center text-xs text-muted-foreground mt-4 border-t pt-3">
              Default admin: <span className="font-mono font-semibold">admin@zdspgc.edu.ph</span> /{" "}
              <span className="font-mono font-semibold">admin123</span>
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-gold font-medium hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
