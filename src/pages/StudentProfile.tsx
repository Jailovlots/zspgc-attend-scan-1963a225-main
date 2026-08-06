import { useState, useEffect, useRef, useCallback } from "react";
import {
  User, Mail, Phone, MapPin, Calendar, GraduationCap, BookOpen, Hash,
  Edit2, Save, X, KeyRound, Eye, EyeOff, ShieldCheck, Users, Camera, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { getSession, setSession, updateStudent, getStudentProfile, StudentUser, updateStudentAvatar, getSystemSettings } from "@/lib/auth";
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
  guardianName: string;
  guardianPhone: string;
  guardianRelation: string;
}

const GENDER_OPTIONS = ["Male", "Female"];
const SUFFIX_OPTIONS = ["", "Jr.", "Sr.", "II", "III", "IV"];

// ── InfoField ── defined OUTSIDE the component to prevent remount on re-render
const InfoField = ({
  label, value, field, icon: Icon, type = "text", editable = true, maxLength, isPhone = false,
  isEditing, editData, onChange,
}: {
  label: string;
  value: string;
  field?: keyof StudentInfo;
  icon?: React.ElementType;
  type?: string;
  editable?: boolean;
  maxLength?: number;
  isPhone?: boolean;
  isEditing: boolean;
  editData: StudentInfo | null;
  onChange: (field: keyof StudentInfo, value: string) => void;
}) => {
  const currentVal = field ? ((editData as any)?.[field] ?? "") : "";
  const phoneError = isPhone && isEditing && editable && currentVal.length > 0 && currentVal.length !== 11;
  const phoneComplete = isPhone && isEditing && editable && currentVal.length === 11;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {isEditing && editable && field ? (
        <>
          <Input
            type={type}
            value={currentVal}
            onChange={(e) => onChange(field, e.target.value)}
            className={`h-9 text-sm transition-colors ${
              phoneError
                ? "border-red-500 focus-visible:ring-red-500 text-red-600"
                : phoneComplete
                ? "border-emerald-500 focus-visible:ring-emerald-500"
                : ""
            }`}
            placeholder={`Enter ${label.toLowerCase()}`}
            maxLength={maxLength}
          />
          {isPhone && (
            <p className={`text-[11px] mt-0.5 transition-colors ${
              phoneError ? "text-red-500" : phoneComplete ? "text-emerald-600" : "text-muted-foreground"
            }`}>
              {currentVal.length}/11 digits{phoneError ? " — must be exactly 11" : phoneComplete ? " ✓" : ""}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm font-medium text-foreground py-1 px-0">{value || "—"}</p>
      )}
    </div>
  );
};

// ── SelectField ── also outside component
const SelectField = ({
  label, value, field, options, icon: Icon, editable = true,
  isEditing, editData, onChange,
}: {
  label: string;
  value: string;
  field: keyof StudentInfo;
  options: string[];
  icon?: React.ElementType;
  editable?: boolean;
  isEditing: boolean;
  editData: StudentInfo | null;
  onChange: (field: keyof StudentInfo, value: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </Label>
    {isEditing && editable ? (
      <Select
        value={(editData as any)?.[field] ?? ""}
        onValueChange={(val) => onChange(field, val)}
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

const compressImage = (base64Str: string, maxWidth = 300, maxHeight = 300): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedBase64);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

const StudentProfile = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<StudentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [systemSemester, setSystemSemester] = useState("");
  const [systemSchoolYear, setSystemSchoolYear] = useState("");

  // Avatar / profile picture
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Load saved avatar from localStorage
    const savedAvatar = localStorage.getItem(`avatar_${session.studentId}`);
    if (savedAvatar) setAvatarUrl(savedAvatar);

    const loadProfile = async () => {
      setIsLoading(true);
      try {
        // Fetch system settings and student profile in parallel
        const [sysSettings, fullProfile] = await Promise.all([
          getSystemSettings(),
          getStudentProfile(session.studentId),
        ]);

        // Use system settings as the authoritative source for semester/schoolYear
        const activeSemester = sysSettings?.semester ? `${sysSettings.semester} Semester` : "";
        const activeSchoolYear = sysSettings?.academicYear || "";
        if (activeSemester) setSystemSemester(activeSemester);
        if (activeSchoolYear) setSystemSchoolYear(activeSchoolYear);
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
            semester: activeSemester || fullProfile.semester || "",
            schoolYear: activeSchoolYear || fullProfile.schoolYear || "",
            guardianName: fullProfile.guardianName || "",
            guardianPhone: fullProfile.guardianPhone || "",
            guardianRelation: fullProfile.guardianRelation || "",
          } as StudentInfo;
          setStudent(profile);
          setEditData(profile);
          setSession(profile);
          if (fullProfile.profileImage) {
            setAvatarUrl(fullProfile.profileImage);
            localStorage.setItem(`avatar_${session.studentId}`, fullProfile.profileImage);
          }
        } else {
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
            semester: activeSemester || sessionData.semester || "",
            schoolYear: activeSchoolYear || sessionData.schoolYear || "",
            guardianName: sessionData.guardianName || "",
            guardianPhone: sessionData.guardianPhone || "",
            guardianRelation: sessionData.guardianRelation || "",
          };
          setStudent(profile);
          setEditData(profile);
          if (profile.profileImage) {
            setAvatarUrl(profile.profileImage);
            localStorage.setItem(`avatar_${session.studentId}`, profile.profileImage);
          }
        }
      } catch (err) {
        toast.error("Failed to load profile. Showing cached data.");
        const session = getSession();
        if (session) {
          const fallback = session as StudentInfo;
          setStudent({ ...fallback } as StudentInfo);
          setEditData({ ...fallback } as StudentInfo);
          if (fallback.profileImage) {
            setAvatarUrl(fallback.profileImage);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!student) return;

    if (student.profileImageUpdates !== undefined && student.profileImageUpdates >= 2) {
      toast.error("Upload limit reached", {
        description: "You have already updated your profile photo 2 times. Further updates are blocked to prevent proxy fraud."
      });
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB.");
      return;
    }

    const loadingToast = toast.loading("Uploading profile photo...");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const originalDataUrl = ev.target?.result as string;
      try {
        // Compress photo to maximum 300x300px for robust performance and server compliance
        const dataUrl = await compressImage(originalDataUrl, 300, 300);

        const result = await updateStudentAvatar(student.studentId, dataUrl);
        toast.dismiss(loadingToast);

        if (result.ok) {
          setAvatarUrl(dataUrl);
          localStorage.setItem(`avatar_${student.studentId}`, dataUrl);

          const updatedUpdates = result.profileImageUpdates ?? ((student.profileImageUpdates || 0) + 1);
          const updatedStudent = {
            ...student,
            profileImage: dataUrl,
            profileImageUpdates: updatedUpdates
          };
          setStudent(updatedStudent);
          setEditData(updatedStudent);
          setSession(updatedStudent);

          toast.success("Profile photo uploaded successfully!", {
            description: `You have updated your profile photo ${updatedUpdates}/2 times.`
          });
        } else {
          toast.error("Upload failed", {
            description: result.error || "Please try again."
          });
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error("Network error. Could not upload photo.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = () => {
    setEditData({ ...student! });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData({ ...student! });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editData) return;

    if (!editData.firstName.trim() || !editData.lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    if (editData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (editData.phone && !/^[0-9]{11}$/.test(editData.phone)) {
      toast.error("Phone number must be exactly 11 digits (numbers only).");
      return;
    }
    if (editData.guardianPhone && !/^[0-9]{11}$/.test(editData.guardianPhone)) {
      toast.error("Guardian contact number must be exactly 11 digits (numbers only).");
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
        toast.error("Failed to update password", { description: result.error });
      }
    } catch {
      toast.error("Network error. Could not update password.");
    } finally {
      setIsSavingPw(false);
    }
  };

  const handleChange = useCallback((field: keyof StudentInfo, value: string) => {
    setEditData((prev) => prev ? ({ ...prev, [field]: value }) : null);
  }, []);

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

  const initials = `${student.firstName?.[0] ?? ""}${student.lastName?.[0] ?? ""}`.toUpperCase();

  // Shared props for InfoField / SelectField
  const fieldProps = { isEditing, editData, onChange: handleChange };

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
              {/* Clickable Avatar */}
              <div className="relative group">
                <Avatar className="h-24 w-24 border-4 border-card shadow-lg ring-2 ring-gold/30">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-gold to-amber-600 text-white text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                {/* Upload overlay — disable if limit reached */}
                {(!student.profileImageUpdates || student.profileImageUpdates < 2) ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload profile photo"
                    className="absolute inset-0 flex items-end justify-center rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <div className="w-full bg-black/55 py-1.5 flex items-center justify-center gap-1">
                      <Camera className="h-3.5 w-3.5 text-white" />
                      <span className="text-[10px] text-white font-semibold">Photo</span>
                    </div>
                  </button>
                ) : (
                  <div
                    title="Photo upload limit reached"
                    className="absolute inset-0 flex items-end justify-center rounded-full overflow-hidden cursor-not-allowed opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <div className="w-full bg-destructive/80 py-1.5 flex items-center justify-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-white" />
                      <span className="text-[10px] text-white font-semibold">Locked</span>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

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
                  <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10">
                    {student.gender}
                  </Badge>
                  <Badge variant="outline" className={
                    (student.profileImageUpdates || 0) >= 2 
                      ? "text-destructive border-destructive/30 bg-destructive/5 font-semibold" 
                      : "text-muted-foreground"
                  }>
                    Photo Uploads: {student.profileImageUpdates || 0}/2
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
                <InfoField label="First Name" value={student.firstName} field="firstName" {...fieldProps} />
                <InfoField label="Last Name" value={student.lastName} field="lastName" {...fieldProps} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Middle Name" value={student.middleName} field="middleName" {...fieldProps} />
                <SelectField
                  label="Suffix"
                  value={student.suffix}
                  field="suffix"
                  options={SUFFIX_OPTIONS}
                  {...fieldProps}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="Gender"
                  value={student.gender}
                  field="gender"
                  options={GENDER_OPTIONS}
                  icon={Users}
                  {...fieldProps}
                />
                <InfoField
                  label="Birthday"
                  value={student.birthday}
                  field="birthday"
                  icon={Calendar}
                  type="date"
                  {...fieldProps}
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
              <InfoField label="Email Address" value={student.email} icon={Mail} field="email" type="email" {...fieldProps} />
              <InfoField label="Phone Number" value={student.phone} icon={Phone} field="phone" type="tel" maxLength={11} isPhone {...fieldProps} />
              <Separator />
              <InfoField label="Street Address" value={student.address} icon={MapPin} field="address" {...fieldProps} />
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="City" value={student.city} field="city" {...fieldProps} />
                <InfoField label="Province" value={student.province} field="province" {...fieldProps} />
              </div>
              <InfoField label="Zip Code" value={student.zipCode} field="zipCode" {...fieldProps} />
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
              <InfoField label="Student ID" value={student.studentId} icon={Hash} field="studentId" editable={false} {...fieldProps} />
              <InfoField label="Course" value={student.course} icon={BookOpen} field="course" editable={false} {...fieldProps} />
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Year Level" value={student.yearLevel} field="yearLevel" editable={false} {...fieldProps} />
                <InfoField label="Section" value={student.section} field="section" editable={false} {...fieldProps} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Semester" value={systemSemester || student.semester} field="semester" editable={false} {...fieldProps} />
                <InfoField label="School Year" value={systemSchoolYear || student.schoolYear} field="schoolYear" editable={false} {...fieldProps} />
              </div>
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
              <InfoField label="Guardian Name" value={student.guardianName} field="guardianName" icon={User} {...fieldProps} />
              <InfoField label="Relationship" value={student.guardianRelation} field="guardianRelation" {...fieldProps} />
              <InfoField label="Contact Number" value={student.guardianPhone} icon={Phone} field="guardianPhone" type="tel" maxLength={11} isPhone {...fieldProps} />
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
