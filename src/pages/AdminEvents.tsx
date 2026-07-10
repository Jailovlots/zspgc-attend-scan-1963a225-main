import { useState, useMemo, useEffect } from "react";
import { Calendar, Search, Plus, Edit2, Trash2, MoreHorizontal, Filter, MapPin, Clock as ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { getEvents, saveEvent, deleteEvent, SchoolEvent } from "@/data/events";
import { getCourseSections, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const AdminEvents = () => {
    const navigate = useNavigate();
    const session = getSession();
    const adminRole = session?.adminRole;
    const [events, setEvents] = useState<SchoolEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [courseSections, setCourseSections] = useState<Record<string, Record<string, string[]>>>({});
    const COURSES = useMemo(() => Object.keys(courseSections).sort(), [courseSections]);

    // Form State
    const [formData, setFormData] = useState<Partial<SchoolEvent>>({
        id: "",
        name: "",
        description: "",
        date: "",
        time: "",
        location: "",
        category: "general",
        targetCourses: [],
        status: "upcoming",
    });

    useEffect(() => {
        if (!session || session.role !== "admin") {
            toast.error("Please log in as an admin to access this page");
            navigate("/login");
            return;
        }

        const init = async () => {
            setIsLoading(true);
            try {
                const [eventsData, sectionsData] = await Promise.all([
                    getEvents(),
                    getCourseSections()
                ]);
                setEvents(eventsData);
                setCourseSections(sectionsData);
            } catch (err) {
                toast.error("Failed to load events");
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const loadEvents = async () => {
        const data = await getEvents();
        setEvents(data);
    };

    const filteredEvents = useMemo(() => {
        return events.filter((e) => {
            const matchesSearch =
                e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.location.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [events, searchQuery, categoryFilter]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setEditingEvent(null);
        setFormData({
            id: `EVT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
            name: "",
            description: "",
            date: "",
            time: "",
            location: "",
            category: "general",
            targetCourses: [],
            status: "upcoming",
        });
        setIsAddDialogOpen(true);
    };

    const handleEditClick = (event: SchoolEvent) => {
        setIsEditMode(true);
        setEditingEvent(event);
        setFormData({ ...event });
        setIsAddDialogOpen(true);
    };

    const handleDeleteClick = (eventId: string) => {
        setDeleteTargetId(eventId);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        const success = await deleteEvent(deleteTargetId);
        if (success) {
            await loadEvents();
            toast.success("Event deleted successfully");
        } else {
            toast.error("Failed to delete event");
        }
        setDeleteTargetId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.date || !formData.time || !formData.location) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSaving(true);
        try {
            const success = await saveEvent(formData as SchoolEvent);
            if (success) {
                await loadEvents();
                setIsAddDialogOpen(false);
                toast.success(isEditMode ? "Event updated successfully" : "Event created successfully");
            } else {
                toast.error("Failed to save event");
            }
        } catch (err) {
            toast.error("Server error. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const updateForm = (key: keyof SchoolEvent, value: any) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const statusColor = (status: SchoolEvent["status"]) => {
        switch (status) {
            case "upcoming": return "bg-accent/10 text-accent border-accent/30";
            case "ongoing": return "bg-success/10 text-success border-success/30";
            case "completed": return "bg-muted text-muted-foreground border-border";
        }
    };

    return (
        <DashboardLayout role="admin" adminRole={adminRole}>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
                            <Calendar className="h-7 w-7 text-gold" />
                            Event Management
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">Create and manage school events</p>
                    </div>
                    <Button onClick={handleAddClick} className="bg-gold text-gold-foreground hover:bg-gold/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Event
                    </Button>
                </div>

                <Card className="shadow-card">
                    <CardHeader className="pb-3 px-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search events..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="course-specific">Course Specific</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="px-6">Event Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEvents.length > 0 ? (
                                    filteredEvents.map((event) => (
                                        <TableRow key={event.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="px-6 font-semibold py-4">
                                                <div>
                                                    <div className="text-foreground">{event.name}</div>
                                                    <div className="text-xs text-muted-foreground font-normal line-clamp-1">{event.description}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize text-[10px]">
                                                    {event.category.replace("-", " ")}
                                                </Badge>
                                                {event.targetCourses.length > 0 && (
                                                    <div className="text-[10px] text-muted-foreground mt-1">
                                                        {event.targetCourses.join(", ")}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {event.date}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                                                    <ClockIcon className="h-3.5 w-3.5" />
                                                    {event.time}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {event.location}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`capitalize ${statusColor(event.status)}`}>
                                                    {event.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right px-6">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEditClick(event)}>
                                                            <Edit2 className="h-4 w-4 mr-2" /> Edit Event
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => handleDeleteClick(event.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" /> Delete Event
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No events found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Event Details" : "Create New Event"}</DialogTitle>
                        <DialogDescription>
                            {isEditMode
                                ? "Update the details for this school event."
                                : "Fill in the information to broadcast a new school event."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="name">Event Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => updateForm("name", e.target.value)}
                                placeholder="e.g., Acquaintance Party 2025"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => updateForm("description", e.target.value)}
                                placeholder="Briefly describe the event purpose..."
                                className="resize-none h-20"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => updateForm("date", e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="time">Time</Label>
                                <Input
                                    id="time"
                                    value={formData.time}
                                    onChange={(e) => updateForm("time", e.target.value)}
                                    placeholder="e.g., 1:00 PM - 5:00 PM"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) => updateForm("location", e.target.value)}
                                placeholder="e.g., ZDSPGC Gymnasium"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v: "general" | "course-specific") => {
                                        updateForm("category", v);
                                        if (v === "general") updateForm("targetCourses", []);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="course-specific">Course Specific</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v: "upcoming" | "ongoing" | "completed") => updateForm("status", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="upcoming">Upcoming</SelectItem>
                                        <SelectItem value="ongoing">Ongoing</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {formData.category === "course-specific" && (
                            <div className="space-y-2">
                                <Label>Target Courses</Label>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {COURSES.map((course) => (
                                        <Button
                                            key={course}
                                            type="button"
                                            variant={formData.targetCourses?.includes(course) ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => {
                                                const current = formData.targetCourses || [];
                                                const next = current.includes(course)
                                                    ? current.filter(c => c !== course)
                                                    : [...current, course];
                                                updateForm("targetCourses", next);
                                            }}
                                            className="h-8 text-xs"
                                        >
                                            {course}
                                        </Button>
                                    ))}
                                    {COURSES.length === 0 && (
                                        <p className="text-xs text-muted-foreground italic">No courses configured. Add them in Sections tab.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving} className="bg-gold text-gold-foreground hover:bg-gold/90">
                                {isSaving ? "Saving..." : (isEditMode ? "Save Changes" : "Create Event")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Event?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this event? This may affect existing attendance records and will be permanent.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default AdminEvents;
