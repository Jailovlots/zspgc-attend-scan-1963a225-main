import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import bsisLogo from "@/assets/bsis-logo.png";
import { saveUser, getCourseSections } from "@/lib/auth";

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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadSections = async () => {
      const sections = await getCourseSections();
      setCourseSections(sections);
    };
    loadSections();
  }, []);

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

    setIsSubmitting(true);
    try {
      const success = await saveUser({
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

      if (success) {
        toast({ title: "Registration successful!", description: "You can now log in." });
        navigate("/login");
      } else {
        toast({ title: "Registration failed", description: "Check if the Student ID is already taken.", variant: "destructive" });
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
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="Juan" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="Dela Cruz" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@zdspgc.edu.ph" value={form.email} onChange={(e) => update("email", e.target.value)} required className="mt-1.5" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="studentId">Student ID</Label>
                <Input id="studentId" placeholder="2024-00001" value={form.studentId} onChange={(e) => update("studentId", e.target.value)} required className="mt-1.5" />
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
