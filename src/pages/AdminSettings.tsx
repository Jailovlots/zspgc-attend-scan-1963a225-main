import { useState, useEffect } from "react";
import { Settings, Users, Plus, Edit2, Trash2, Eye, EyeOff, Shield, UserCheck, Save, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DashboardLayout from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { getAllAdmins, createAdmin, updateAdmin, deleteAdmin, AdminUser, getSession, logout, getSystemSettings, updateSystemSettings } from "@/lib/auth";
import { toast } from "sonner";

interface SystemSettings {
    schoolName: string;
    academicYear: string;
    semester: string;
    lateThreshold: string; // e.g. "08:30"
}
const defaultSettings: SystemSettings = {
    schoolName: "ZDSPGC",
    academicYear: "2024-2025",
    semester: "1st",
    lateThreshold: "08:30"
};

const AdminSettings = () => {
    const navigate = useNavigate();
    const session = getSession();
    const currentAdminId = session?.adminId as number | undefined;
    const adminRole = session?.adminRole;

    // --- Officer Accounts ---
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({ name: "", email: "", role: "officer" as "officer" | "superadmin", password: "" });

    // --- System Settings ---
    const [sysSettings, setSysSettings] = useState<SystemSettings>(defaultSettings);
    const [isSavingSys, setIsSavingSys] = useState(false);

    useEffect(() => {
        if (!session || session.role !== "admin") {
            toast.error("Please log in as an admin to access this page");
            navigate("/login");
            return;
        }

        if (session.adminRole === "officer") {
            toast.error("You do not have permission to access the Settings page");
            navigate("/admin");
            return;
        }

        loadAdmins();
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const settings = await getSystemSettings();
        if (settings) {
            setSysSettings(settings);
        }
    };

    const loadAdmins = async () => {
        setIsLoadingAdmins(true);
        try {
            const data = await getAllAdmins();
            setAdmins(data);
        } catch {
            toast.error("Failed to load officer accounts");
        } finally {
            setIsLoadingAdmins(false);
        }
    };

    const openAdd = () => {
        setIsEditMode(false);
        setEditingAdmin(null);
        setForm({ name: "", email: "", role: "officer", password: "" });
        setShowPassword(false);
        setIsDialogOpen(true);
    };

    const openEdit = (admin: AdminUser) => {
        setIsEditMode(true);
        setEditingAdmin(admin);
        setForm({ name: admin.name, email: admin.email, role: admin.role, password: admin.password });
        setShowPassword(false);
        setIsDialogOpen(true);
    };

    const handleSaveOfficer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.password) {
            toast.error("All fields are required");
            return;
        }
        setIsSaving(true);
        try {
            if (isEditMode && editingAdmin) {
                const result = await updateAdmin(editingAdmin.id, form);
                if (result.ok) {
                    toast.success("Officer updated successfully");
                    setIsDialogOpen(false);
                    await loadAdmins();
                } else {
                    toast.error(result.error || "Failed to update officer");
                }
            } else {
                const result = await createAdmin(form);
                if (result.ok) {
                    toast.success("Officer account created successfully");
                    setIsDialogOpen(false);
                    await loadAdmins();
                } else {
                    toast.error(result.error || "Failed to create officer");
                }
            }
        } catch {
            toast.error("Operation failed. Try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const ok = await deleteAdmin(deleteTarget.id);
        if (ok) {
            toast.success("Officer account removed");
            await loadAdmins();
        } else {
            toast.error("Failed to remove officer");
        }
        setDeleteTarget(null);
    };

    const handleSaveSystem = async () => {
        setIsSavingSys(true);
        const success = await updateSystemSettings(sysSettings);
        if (success) {
            toast.success("System settings saved");
        } else {
            toast.error("Failed to save settings");
        }
        setIsSavingSys(false);
    };

    const roleBadge = (role: string) =>
        role === "superadmin" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold text-[10px] font-bold uppercase">
                <Shield className="h-2.5 w-2.5" /> Super Admin
            </span>
        ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase">
                <UserCheck className="h-2.5 w-2.5" /> Officer
            </span>
        );

    return (
        <DashboardLayout role="admin" adminRole={adminRole}>
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
                        <Settings className="h-7 w-7 text-gold" />
                        Settings
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage officer accounts and system configuration</p>
                </div>

                <Tabs defaultValue="officers">
                    <TabsList className="mb-4">
                        <TabsTrigger value="officers" className="flex items-center gap-2">
                            <Users className="h-4 w-4" /> Officer Accounts
                        </TabsTrigger>
                        <TabsTrigger value="system" className="flex items-center gap-2">
                            <School className="h-4 w-4" /> Settings
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Officer Accounts Tab ── */}
                    <TabsContent value="officers">
                        <Card className="shadow-card">
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-sans">Officer Accounts</CardTitle>
                                        <CardDescription>
                                            Each officer can log in separately using the Admin login tab. All officers have full access to the system.
                                        </CardDescription>
                                    </div>
                                    <Button onClick={openAdd} className="bg-gold text-gold-foreground hover:bg-gold/90 shrink-0">
                                        <Plus className="h-4 w-4 mr-2" /> Add Officer
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoadingAdmins ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                                    </div>
                                ) : admins.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">
                                        <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No officer accounts yet.</p>
                                        <p className="text-xs mt-1">Click "Add Officer" to create the first account.</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="px-6">Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead>Created</TableHead>
                                                <TableHead className="text-right px-6">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {admins.map((admin) => (
                                                <TableRow key={admin.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="px-6 font-semibold">
                                                        {admin.name}
                                                        {admin.id === currentAdminId && (
                                                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-gold/10 text-gold font-bold">YOU</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{admin.email}</TableCell>
                                                    <TableCell>{roleBadge(admin.role)}</TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">
                                                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right px-6">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="sm" onClick={() => openEdit(admin)} className="h-8 w-8 p-0">
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 hover:text-destructive"
                                                                onClick={() => setDeleteTarget(admin)}
                                                                disabled={admin.id === currentAdminId}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── System Settings Tab ── */}
                    <TabsContent value="system">
                        <div className="space-y-4">
                            {/* School Info */}
                            <Card className="shadow-card">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-sans">School Information</CardTitle>
                                    <CardDescription>Used in reports and exported documents</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label>School Name</Label>
                                        <Input
                                            value={sysSettings.schoolName}
                                            onChange={(e) => setSysSettings((p) => ({ ...p, schoolName: e.target.value }))}
                                            placeholder="School name..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label>Academic Year</Label>
                                            <Input
                                                value={sysSettings.academicYear}
                                                onChange={(e) => setSysSettings((p) => ({ ...p, academicYear: e.target.value }))}
                                                placeholder="e.g. 2024-2025"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Current Semester</Label>
                                            <Select value={sysSettings.semester} onValueChange={(v) => setSysSettings((p) => ({ ...p, semester: v }))}>
                                                <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1st">1st Semester</SelectItem>
                                                    <SelectItem value="2nd">2nd Semester</SelectItem>
                                                    <SelectItem value="Summer">Summer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* QR Scanner Settings */}
                            <Card className="shadow-card">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-sans">QR Scanner Settings</CardTitle>
                                    <CardDescription>Configure attendance rules for events</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label>Late Threshold Time</Label>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="time"
                                                value={sysSettings.lateThreshold}
                                                onChange={(e) => setSysSettings((p) => ({ ...p, lateThreshold: e.target.value }))}
                                                className="w-40"
                                            />
                                            <p className="text-sm text-muted-foreground">
                                                Students scanning after <strong>{sysSettings.lateThreshold}</strong> will be marked <span className="text-yellow-600 font-medium">Late</span>.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button onClick={handleSaveSystem} disabled={isSavingSys} className="bg-gold text-gold-foreground hover:bg-gold/90">
                                <Save className="h-4 w-4 mr-2" />
                                {isSavingSys ? "Saving..." : "Save Settings"}
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Add / Edit Officer Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Officer Account" : "Add New Officer"}</DialogTitle>
                        <DialogDescription>
                            {isEditMode
                                ? "Update this officer's info. They can log in with the Admin tab on the login page."
                                : "Create a new officer account. They will be able to log in as Admin."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveOfficer} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Full Name</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Juan Dela Cruz"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Email Address</Label>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                placeholder="officer@zdspgc.edu.ph"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Role</Label>
                            <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as "officer" | "superadmin" }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="officer">Officer — event scanner access</SelectItem>
                                    <SelectItem value="superadmin">Super Admin — full system access</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Password</Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={form.password}
                                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                                    placeholder="••••••••"
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
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving} className="bg-gold text-gold-foreground hover:bg-gold/90">
                                {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Create Officer"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Officer Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove <strong>{deleteTarget?.name}</strong>'s account. They will no longer be able to log in.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default AdminSettings;
