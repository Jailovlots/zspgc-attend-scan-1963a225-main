import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import bsisLogo from "@/assets/bsis-logo.png";
import { saveUser, getCourseSections, getQualifiedStudents } from "@/lib/auth";

const Register = () => {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    studentId: "",
    password: "",
    confirmPassword: "",
    course: "",
    yearLevel: "",
    section: "",
    gender: "" as "Male" | "Female" | "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseSections, setCourseSections] = useState<Record<string, Record<string, string[]>>>({});
  // Qualified student ID check state
  const [qualifiedIds, setQualifiedIds] = useState<Set<string>>(new Set());
  const [qualifiedListActive, setQualifiedListActive] = useState(false);
  const [idStatus, setIdStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const idCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const [sections, qualified] = await Promise.all([
        getCourseSections(),
        getQualifiedStudents()
      ]);
      setCourseSections(sections);
      if (qualified.length > 0) {
        setQualifiedListActive(true);
        setQualifiedIds(new Set(qualified.map(q => q.studentId.trim().toUpperCase())));
      }
    };
    load();
  }, []);

  // Debounced validation of the student ID field against the qualified list
  const handleStudentIdChange = (value: string) => {
    update("studentId", value);
    if (idCheckTimer.current) clearTimeout(idCheckTimer.current);
    if (!qualifiedListActive || !value.trim()) {
      setIdStatus("idle");
      return;
    }
    idCheckTimer.current = setTimeout(() => {
      const normalized = value.trim().toUpperCase();
      setIdStatus(qualifiedIds.has(normalized) ? "valid" : "invalid");
    }, 400);
  };

  const availableSections = useMemo(() => {
    if (form.course && form.yearLevel) {
      return courseSections[form.course]?.[form.yearLevel] || [];
    }
    return [];
  }, [form.course, form.yearLevel, courseSections]);

  // Reset yearLevel and section when course changes
  useEffect(() => {
    setForm((f) => ({ ...f, yearLevel: "", section: "" }));
  }, [form.course]);

  // Reset section when yearLevel changes
  useEffect(() => {
    setForm((f) => ({ ...f, section: "" }));
  }, [form.yearLevel]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    if (!form.course || !form.yearLevel || !form.section || !form.gender) {
      toast({ title: "Error", description: "Please complete your educational and personal details.", variant: "destructive" });
      return;
    }

    // Block if student ID is explicitly flagged as not qualified
    if (qualifiedListActive && idStatus === "invalid") {
      toast({ title: "Not Qualified", description: `Student ID "${form.studentId}" is not in the approved list. Contact your administrator.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await saveUser({
        studentId: form.studentId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        course: form.course,
        yearLevel: form.yearLevel,
        section: form.section,
        gender: form.gender as "Male" | "Female",
        role: "student",
        password: form.password,
      });

      if (result.ok) {
        toast({ title: "Registration successful!", description: "You can now log in." });
        navigate("/login");
      } else {
        toast({ title: "Registration failed", description: result.error || "Check if the Student ID is already taken.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Server Error", description: "Could not connect to the backend.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4">
            <img src={bsisLogo} alt="BSIS Logo" className="h-14 w-14 rounded-full object-cover" />
          </Link>
          <h1 className="text-2xl font-display font-bold text-primary-foreground">Create Account</h1>
          <p className="text-primary-foreground/60 text-sm mt-1">Join AttendWise today</p>
        </div>

        <div className="bg-card rounded-xl shadow-elevated p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="DELA CRUZ" value={form.lastName} onChange={(e) => update("lastName", e.target.value.toUpperCase())} required className="mt-1.5 uppercase" />
              </div>
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="JUAN" value={form.firstName} onChange={(e) => update("firstName", e.target.value.toUpperCase())} required className="mt-1.5 uppercase" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@zdspgc.edu.ph" value={form.email} onChange={(e) => update("email", e.target.value)} required className="mt-1.5" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="studentId">Student ID</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="studentId"
                    placeholder="2024-00001"
                    value={form.studentId}
                    onChange={(e) => handleStudentIdChange(e.target.value)}
                    required
                    className={idStatus === "valid" ? "border-green-500 pr-9" : idStatus === "invalid" ? "border-destructive pr-9" : ""}
                  />
                  {idStatus === "valid" && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />}
                  {idStatus === "invalid" && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />}
                </div>
                {idStatus === "invalid" && (
                  <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> This ID is not on the qualified list. Contact your admin.
                  </p>
                )}
                {idStatus === "valid" && (
                  <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Student ID is approved for registration.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="course">Course</Label>
                <Select value={form.course} onValueChange={(v) => update("course", v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(courseSections).sort().map((course) => (
                      <SelectItem key={course} value={course}>{course}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="yearLevel">Year Level</Label>
                <Select value={form.yearLevel} onValueChange={(v) => update("yearLevel", v)} disabled={!form.course}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {form.course && Object.keys(courseSections[form.course] || {}).sort().map((year) => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="section">Section</Label>
                <Select value={form.section} onValueChange={(v) => update("section", v)} disabled={!form.yearLevel || !form.course}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSections.map((sec) => (
                      <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={(e) => update("password", e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} required className="mt-1.5" />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full bg-gold text-gold-foreground hover:bg-gold/90 font-semibold">
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-gold font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
