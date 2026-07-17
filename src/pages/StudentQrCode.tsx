import { useState, useMemo, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Calendar, MapPin, Clock, ChevronRight, Sparkles, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { getEvents, generateEventQrToken, type SchoolEvent } from "@/data/events";
import { getSession, setSession, getStudentProfile, type StudentUser } from "@/lib/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { syncTimeWithServer } from "@/lib/timeSync";

const StudentQrCode = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [student, setStudent] = useState<StudentUser | null>(getSession());
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [generatedTokens, setGeneratedTokens] = useState<Record<string, { token: string; payload: any }>>({});
  const [countdown, setCountdown] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!student || student.role !== "student") {
      toast.error("Please log in as a student to access this page");
      navigate("/login");
    }
  }, [student, navigate]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        // Synchronize local time with server before generating QR tokens
        await syncTimeWithServer();

        // Fetch fresh student profile to sync details (e.g. section)
        const session = getSession();
        if (session && session.studentId) {
          const fresh = await getStudentProfile(session.studentId);
          if (fresh) {
            setSession(fresh);
            setStudent(fresh);
          }
        }

        const data = await getEvents();
        // Only show upcoming/ongoing events, filter out completed ones to sync with dashboard
        const activeEvents = data.filter((e) => e.status !== "completed");
        setEvents(activeEvents);
      } catch (err) {
        toast.error("Failed to load events");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Show all upcoming/ongoing events
  const availableEvents = useMemo(
    () => events,
    [events]
  );

  const handleGenerateQr = (event: SchoolEvent, quiet = false) => {
    if (!student) return;
    const result = generateEventQrToken(
      student.studentId,
      `${student.firstName} ${student.lastName}`,
      event.id,
      event.name
    );
    setGeneratedTokens((prev) => ({ ...prev, [event.id]: result }));
    setCountdown(10);
    if (!quiet) {
      toast.success(`QR Code generated for ${event.name}`);
    }
    setSelectedEvent(event);
  };

  useEffect(() => {
    const eventId = searchParams.get("event");
    if (eventId && student) {
      const event = availableEvents.find(e => e.id === eventId);
      if (event) {
        handleGenerateQr(event);
      }
    }
  }, [searchParams, availableEvents]);

  // Handle auto-refresh every 10 seconds for the selected event
  useEffect(() => {
    if (!selectedEvent) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleGenerateQr(selectedEvent, true);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedEvent]);

  if (!student || isLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  const currentToken = selectedEvent ? generatedTokens[selectedEvent.id] : null;

  const statusColor = (status: SchoolEvent["status"]) => {
    switch (status) {
      case "upcoming": return "bg-accent/10 text-accent border-accent/30";
      case "ongoing": return "bg-success/10 text-success border-success/30";
      case "completed": return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <DashboardLayout role="student">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <QrCode className="h-7 w-7 text-gold" />
            Event QR Codes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate your unique QR code for each event — show it to the admin scanner for attendance
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Event List */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Available Events ({availableEvents.length})</h2>
            {availableEvents.map((event) => {
              const isSelected = selectedEvent?.id === event.id;
              const hasQr = !!generatedTokens[event.id];

              return (
                <Card
                  key={event.id}
                  className={`shadow-card cursor-pointer transition-all hover:shadow-elevated ${isSelected ? "ring-2 ring-gold" : ""
                    }`}
                  onClick={() => handleGenerateQr(event)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground text-sm">{event.name}</h3>
                          <Badge variant="outline" className={statusColor(event.status)}>
                            {event.status}
                          </Badge>
                          {event.category === "course-specific" && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              {event.targetCourses.join(", ")}
                            </Badge>
                          )}
                          {hasQr && (
                            <Badge className="bg-success/10 text-success border-success/30 text-[10px]">
                              <QrCode className="h-3 w-3 mr-1" />
                              Generated
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {event.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* QR Code Display */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <Card className="shadow-card">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-base font-sans">
                    {selectedEvent ? selectedEvent.name : "Select an Event"}
                  </CardTitle>
                  {selectedEvent && (
                    <p className="text-xs text-muted-foreground">
                      {student.firstName} {student.lastName} — {student.section}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  {currentToken ? (
                    <>
                      <div className="bg-card p-5 rounded-2xl border-2 border-gold/30 shadow-md relative">
                        <QRCodeSVG
                          value={currentToken.token}
                          size={280}
                          bgColor="#FFFFFF"
                          fgColor="#000000"
                          level="H"
                          includeMargin={true}
                        />
                        <div className="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-gold text-gold-foreground flex items-center justify-center font-bold text-sm shadow-lg border-2 border-white">
                          {countdown}s
                        </div>
                      </div>
                      <p className="text-[10px] uppercase tracking-widest text-gold font-bold animate-pulse">
                        Refreshing Security Token
                      </p>

                      {/* Token details */}
                      <div className="w-full space-y-2 text-xs">
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Student</span>
                          <span className="font-medium text-foreground">{currentToken.payload.studentName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Student ID</span>
                          <span className="font-mono text-foreground">{currentToken.payload.studentId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Event</span>
                          <span className="font-medium text-foreground">{currentToken.payload.eventName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Generated</span>
                          <span className="text-foreground">
                            {currentToken.payload.generatedDate} at {currentToken.payload.generatedTime}
                          </span>
                        </div>
                        <Separator />
                        <p className="text-[10px] text-muted-foreground text-center font-mono break-all">
                          {currentToken.token}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">No event selected</p>
                      <p className="text-xs mt-1">Tap an event to generate your unique QR code</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card className="shadow-card mt-4">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">How it works</h3>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Select the event you're attending</li>
                    <li>A unique QR code is generated with your info</li>
                    <li>Show the QR code to the admin at the event entrance</li>
                    <li>Your attendance is recorded automatically</li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentQrCode;
