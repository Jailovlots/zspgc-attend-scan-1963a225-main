import { useState, useEffect } from "react";
import {
  User, Mail, Phone, MapPin, Calendar, GraduationCap, BookOpen, Hash,
  Edit2, Save, X, KeyRound, Eye, EyeOff, ShieldCheck, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { getSession, setSession, updateStudent, getStudentProfile, StudentUser } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

interface StudentInfo extends StudentUser {
  middleName: string;
  suffix: string;
  phone: string;
  birthday: string;
  gender: "Male" | "Female";
  address: string;
  city: string;
  province: string;
  zipCode: string;
  semester: string;
  schoolYear: string;
  enrollmentStatus: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelation: string;
}

const GENDER_OPTIONS = ["Male", "Female"];
const SUFFIX_OPTIONS = ["", "Jr.", "Sr.", "II", "III", "IV"];

const StudentProfile = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<StudentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isSavingPw, setIsSavingPw] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "student") {
      navigate("/login");
      return;
    }

    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const fullProfile = await getStudentProfile(session.studentId);
        if (fullProfile) {
          const profile: StudentInfo = {
            ...fullProfile,
            middleName: fullProfile.middleName || "",
            suffix: fullProfile.suffix || "",
            phone: fullProfile.phone || "",
            birthday: fullProfile.birthday || "",
            gender: (fullProfile.gender as "Male" | "Female") || "Male",
            address: fullProfile.address || "",
            city: fullProfile.city || "",
            province: fullProfile.province || "",
            zipCode: fullProfile.zipCode || "",
            semester: fullProfile.semester || "2nd Semester",
            schoolYear: fullProfile.schoolYear || "2024-2025",
            enrollmentStatus: fullProfile.enrollmentStatus || "Regular",
            guardianName: fullProfile.guardianName || "",
            guardianPhone: fullProfile.guardianPhone || "",
            guardianRelation: fullProfile.guardianRelation || "",
          } as StudentInfo;
          setStudent(profile);
          setEditData(profile);
        } else {
          // Fallback: use session data directly
          const sessionData = session as StudentInfo;
          const profile: StudentInfo = {
            ...sessionData,
            middleName: sessionData.middleName || "",
            suffix: sessionData.suffix || "",
            phone: sessionData.phone || "",
            birthday: sessionData.birthday || "",
            gender: (sessionData.gender as "Male" | "Female") || "Male",
            address: sessionData.address || "",
            city: sessionData.city || "",
            province: sessionData.province || "",
            zipCode: sessionData.zipCode || "",
            semester: sessionData.semester || "2nd Semester",
            schoolYear: sessionData.schoolYear || "2024-2025",
            enrollmentStatus: sessionData.enrollmentStatus || "Regular",
            guardianName: sessionData.guardianName || "",
            guardianPhone: sessionData.guardianPhone || "",
            guardianRelation: sessionData.guardianRelation || "",
          };
          setStudent(profile);
          setEditData(profile);
        }
      } catch (err) {
        toast.error("Failed to load profile. Showing cached data.");
        const session = getSession();
        if (session) {
          const fallback = session as StudentInfo;
          setStudent({ ...fallback } as StudentInfo);
          setEditData({ ...fallback } as StudentInfo);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [navigate]);

  if (isLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your profile…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!student || !editData) {
    return (
      <DashboardLayout role="student">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-muted-foreground">Could not load profile data.</p>
          <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleEdit = () => {
    setEditData({ ...student });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData({ ...student });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editData) return;

    // Basic validation
    if (!editData.firstName.trim() || !editData.lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (editData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (editData.phone && !/^[0-9+\s()-]{7,15}$/.test(editData.phone)) {
      toast.error("Please enter a valid phone number.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateStudent(editData.studentId, editData);
      if (result.ok) {
        setStudent({ ...editData });
        setSession(editData);
        setIsEditing(false);
        toast.success("Profile updated successfully!");
      } else {
        toast.error("Failed to save profile", {
          description: result.error || "Please try again.",
        });
      }
    } catch (err) {
      toast.error("Network error. Could not connect to server.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!currentPassword.trim()) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    // Verify current password matches session
    const session = getSession();
    if (session?.password && session.password !== currentPassword) {
      toast.error("Current password is incorrect.");
      return;
    }

    setIsSavingPw(true);
    try {
      const updated = { ...student!, password: newPassword };
      const result = await updateStudent(student!.studentId, updated);
      if (result.ok) {
        setSession({ ...updated });
        setStudent(updated as StudentInfo);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setIsChangingPassword(false);
        toast.success("Password changed successfully!");
      } else {
        toast.error("Failed to update password", {
          description: result.error,
        });
      }
    } catch {
      toast.error("Network error. Could not update password.");
    } finally {
      setIsSavingPw(false);
    }
  };

  const handleChange = (field: keyof StudentInfo, value: string) => {
    setEditData((prev) => prev ? ({ ...prev, [field]: value }) : null);
  };

  // Reusable field — plain text or input based on editing mode
  const InfoField = ({
    label, value, field, icon: Icon, type = "text", editable = true,
  }: {
    label: string;
    value: string;
    field?: keyof StudentInfo;
    icon?: React.ElementType;
    type?: string;
    editable?: boolean;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {isEditing && editable && field ? (
        <Input
          type={type}
          value={(editData as any)[field] ?? ""}
          onChange={(e) => handleChange(field, e.target.value)}
          className="h-9 text-sm"
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      ) : (
        <p className="text-sm font-medium text-foreground py-1 px-0">{value || "—"}</p>
      )}
    </div>
  );

  // Select field for enum values (gender, suffix)
  const SelectField = ({
    label, value, field, options, icon: Icon, editable = true,
  }: {
    label: string;
    value: string;
    field: keyof StudentInfo;
    options: string[];
    icon?: React.ElementType;
    editable?: boolean;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {isEditing && editable ? (
        <Select
          value={(editData as any)[field] ?? ""}
          onValueChange={(val) => handleChange(field, val)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt || "__empty__"} value={opt || "__empty__"}>
                {opt || "(none)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm font-medium text-foreground py-1">{value || "—"}</p>
      )}
    </div>
  );

  const initials = `${student.firstName?.[0] ?? ""}${student.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <DashboardLayout role="student">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
              <User className="h-7 w-7 text-gold" />
              My Profile
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              View and manage your personal information
            </p>
          </div>
          {!isEditing ? (
            <Button onClick={handleEdit} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleCancel} variant="outline" size="sm" disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="bg-gold text-gold-foreground hover:bg-gold/90"
              >
                {isSaving ? (
                  <>
                    <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Profile Banner Card */}
        <Card className="shadow-card overflow-hidden">
          <div className="h-28 bg-gradient-to-r from-primary via-primary/80 to-primary/60 relative">
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.05) 10px, rgba(255,255,255,.05) 20px)"
              }}
            />
          </div>
          <CardContent className="relative pb-6 px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-14">
              <Avatar className="h-24 w-24 border-4 border-card shadow-lg ring-2 ring-gold/30">
                <AvatarFallback className="bg-gradient-to-br from-gold to-amber-600 text-white text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 pt-2 sm:pt-0">
                <h2 className="text-xl font-bold text-foreground">
                  {student.firstName}
                  {student.middleName ? ` ${student.middleName[0]}.` : ""}
                  {` ${student.lastName}`}
                  {student.suffix ? ` ${student.suffix}` : ""}
                </h2>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">{student.studentId}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-gold/10 text-gold border-gold/30">{student.course}</Badge>
                  <Badge variant="outline">{student.section}</Badge>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                    {student.enrollmentStatus || "Regular"}
                  </Badge>
                  <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10">
                    {student.gender}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Personal Information */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <User className="h-4 w-4 text-gold" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="First Name" value={student.firstName} field="firstName" />
                <InfoField label="Last Name" value={student.lastName} field="lastName" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Middle Name" value={student.middleName} field="middleName" />
                <SelectField
                  label="Suffix"
                  value={student.suffix}
                  field="suffix"
                  options={SUFFIX_OPTIONS}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="Gender"
                  value={student.gender}
                  field="gender"
                  options={GENDER_OPTIONS}
                  icon={Users}
                />
                <InfoField
                  label="Birthday"
                  value={student.birthday}
                  field="birthday"
                  icon={Calendar}
                  type="date"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <Mail className="h-4 w-4 text-gold" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoField label="Email Address" value={student.email} icon={Mail} field="email" type="email" />
              <InfoField label="Phone Number" value={student.phone} icon={Phone} field="phone" type="tel" />
              <Separator />
              <InfoField label="Street Address" value={student.address} icon={MapPin} field="address" />
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="City" value={student.city} field="city" />
                <InfoField label="Province" value={student.province} field="province" />
              </div>
              <InfoField label="Zip Code" value={student.zipCode} field="zipCode" />
            </CardContent>
          </Card>

          {/* Academic Information */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-gold" />
                Academic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoField label="Student ID" value={student.studentId} icon={Hash} field="studentId" editable={false} />
              <InfoField label="Course" value={student.course} icon={BookOpen} field="course" editable={false} />
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Year Level" value={student.yearLevel} field="yearLevel" editable={false} />
                <InfoField label="Section" value={student.section} field="section" editable={false} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Semester" value={student.semester} field="semester" editable={false} />
                <InfoField label="School Year" value={student.schoolYear} field="schoolYear" editable={false} />
              </div>
              <InfoField label="Enrollment Status" value={student.enrollmentStatus} field="enrollmentStatus" editable={false} />
            </CardContent>
          </Card>

          {/* Guardian / Emergency Contact */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <Users className="h-4 w-4 text-gold" />
                Guardian / Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoField label="Guardian Name" value={student.guardianName} field="guardianName" icon={User} />
              <InfoField label="Relationship" value={student.guardianRelation} field="guardianRelation" />
              <InfoField label="Contact Number" value={student.guardianPhone} icon={Phone} field="guardianPhone" type="tel" />
            </CardContent>
          </Card>
        </div>

        {/* Change Password */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-gold" />
                Account Security
              </CardTitle>
              {!isChangingPassword ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingPassword(true)}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                  Change Password
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!isChangingPassword ? (
              <div className="flex items-center gap-3 py-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">Password is set</p>
                  <p className="text-xs text-muted-foreground">Click "Change Password" to update your login credentials.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-sm">
                {/* Current Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && newPassword.length < 6 && (
                    <p className="text-xs text-destructive">Password must be at least 6 characters.</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match.</p>
                  )}
                  {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 6 && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                <Button
                  onClick={handlePasswordSave}
                  disabled={isSavingPw}
                  className="bg-gold text-gold-foreground hover:bg-gold/90 w-full"
                  size="sm"
                >
                  {isSavingPw ? (
                    <>
                      <div className="h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Updating…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      Update Password
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default StudentProfile;
