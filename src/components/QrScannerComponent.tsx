import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

interface QrScannerComponentProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

const QrScannerComponent = ({ onScanSuccess, onScanError }: QrScannerComponentProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  // Use a ref for isStarted so stopScanner always reads the latest value (fixes stale closure bug)
  const isStartedRef = useRef(false);
  const [isStarted, setIsStarted] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isNativeApp, setIsNativeApp] = useState(false);

  // Cooldown ref: prevents the same QR from firing onScanSuccess multiple times per scan
  const scanCooldownRef = useRef(false);

  // Keep a stable ref to the latest onScanSuccess so the scanner callback never goes stale
  const onScanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    isMountedRef.current = true;

    // Check for native app bridge (it may take a moment to inject)
    const checkBridge = () => {
      if ((window as any).ReactNativeWebView) {
        setIsNativeApp(true);
        return true;
      }
      return false;
    };

    if (!checkBridge()) {
      const interval = setInterval(() => {
        if (checkBridge()) {
          clearInterval(interval);
        }
      }, 500);
      // Stop checking after 10 seconds
      setTimeout(() => clearInterval(interval), 10000);
    }

    // 1. Web Scanner Initialization (for desktop/HTTPS)
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
          );
          setSelectedCamera(backCam ? backCam.id : devices[0].id);
        } else {
          setError("No cameras found on this device.");
        }
      })
      .catch((err) => {
        setError("Could not access cameras. Please allow camera permission.");
        console.error("Camera error:", err);
      });

    // 2. Native Bridge Listener (for mobile app)
    const handleNativeScan = (event: any) => {
      const decodedText = event.detail;
      onScanSuccessRef.current(decodedText);
      toast.success("Native scan successful");
    };

    window.addEventListener('nativeScan', handleNativeScan);

    // 3. Ping the bridge
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'PING' }));
    }

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('nativeScan', handleNativeScan);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount — onScanSuccess accessed via ref

  // Auto-start when a camera is selected (only if not already started)
  useEffect(() => {
    if (selectedCamera && !isStartedRef.current) {
      startScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera]);

  const startScanner = async () => {
    if (!selectedCamera) return;

    try {
      // Clean up any existing scanner instance first
      if (scannerRef.current) {
        try {
          if (isStartedRef.current) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) { /* ignore */ }
        scannerRef.current = null;
        isStartedRef.current = false;
        setIsStarted(false);
      }

      if (!isMountedRef.current) return;

      const scanner = new Html5Qrcode("qr-reader", {
        verbose: false
      });
      scannerRef.current = scanner;
      // Reset scan cooldown for new session
      scanCooldownRef.current = false;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          // Clamp the qrbox dimension to at least 50px to prevent the runtime error
          const qrboxSize = Math.max(50, Math.floor(minEdge * 0.7));
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
      };

      await scanner.start(
        selectedCamera,
        config,
        (decodedText) => {
          console.log("[Scanner Component] Decoded text:", decodedText);
          // Cooldown prevents the same QR from firing multiple times per scan session
          if (scanCooldownRef.current) {
            console.log("[Scanner Component] Ignored due to cooldown");
            return;
          }
          scanCooldownRef.current = true;
          // Allow re-scanning after 4 seconds (enough time for admin to confirm or reject)
          setTimeout(() => {
            scanCooldownRef.current = false;
          }, 4000);

          console.log("[Scanner Component] Calling onScanSuccessRef.current with:", decodedText);
          onScanSuccessRef.current(decodedText);
        },
        (_errorMessage) => {
          // Ignore per-frame scan failures (normal when no QR is in frame)
        }
      );

      if (isMountedRef.current) {
        isStartedRef.current = true;
        setIsStarted(true);
        setError("");
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.error("Scanner start error:", err);
        const msg = err?.message || "Failed to start scanner. Please ensure camera permissions are granted.";
        setError(msg);
        onScanError?.(msg);
      }
    }
  };

  const startNativeScan = () => {
    // Message to Expo mobile app via react-native-webview bridge
    if (isNativeApp) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'START_NATIVE_SCAN' }));
    } else {
      toast.error("Bridge not found", {
        description: "The native scanner only works inside our mobile app."
      });
    }
  };

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        // Use the ref value (not the state) to avoid stale closure
        if (isStartedRef.current) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.error("Stop error:", e);
      }
      scannerRef.current = null;
      isStartedRef.current = false;
      setIsStarted(false);
    }
  }, []);

  const refreshCameras = () => {
    setError("");
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
          );
          const newCamId = backCam ? backCam.id : devices[0].id;
          // Stop the current scanner then restart with the refreshed camera
          stopScanner().then(() => {
            setSelectedCamera(newCamId);
          });
          toast.success("Cameras refreshed");
        } else {
          setError("No cameras found. Please check connections and permissions.");
        }
      })
      .catch((err) => {
        setError("Camera access denied or failed.");
        console.error("Refresh error:", err);
      });
  };

  const switchCamera = async (cameraId: string) => {
    if (cameraId === selectedCamera && isStartedRef.current) return;
    // Stop first, then update selectedCamera — the useEffect will restart the scanner
    await stopScanner();
    setSelectedCamera(cameraId);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Mobile App Shortcut - Only show if in the actual App shell */}
      {isNativeApp && !isStarted && (
        <button
          onClick={startNativeScan}
          className="w-full bg-primary/10 text-primary border border-primary/20 py-4 rounded-xl font-bold flex flex-col items-center gap-1 hover:bg-primary/20 transition-all active:scale-[0.98]"
        >
          <span className="text-lg">📱 Open Phone Scanner</span>
          <span className="text-[10px] uppercase tracking-tight opacity-70">Native Bridge Enabled</span>
        </button>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive text-xs p-4 rounded-xl w-full flex flex-col gap-3 items-center border border-destructive/20">
          <p className="text-center font-bold text-sm">Scanner Issue Detected</p>
          <p className="text-center opacity-80">{error}</p>
          
          <div className="grid grid-cols-1 gap-2 w-full mt-2">
            {!isNativeApp && (
              <div className="bg-white/50 p-2 rounded-lg border border-destructive/10 text-[10px] space-y-1">
                <p className="font-bold">⚠️ You are in a Browser (Chrome)</p>
                <p>Cameras are blocked on "http" addresses. For the native scanner, please use the Expo Go App instead of Chrome.</p>
              </div>
            )}
            
            <div className="flex gap-2 justify-center">
              <button 
                onClick={refreshCameras}
                className="text-[10px] bg-destructive/20 hover:bg-destructive/30 px-4 py-2 rounded-lg transition-colors font-medium"
              >
                Refresh
              </button>
              {isNativeApp && (
                <button 
                  onClick={startNativeScan}
                  className="text-[10px] bg-gold text-gold-foreground px-4 py-2 rounded-lg transition-colors font-bold shadow-sm"
                >
                  Use Phone Scanner
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        id="qr-reader"
        className="w-full max-w-md rounded-xl overflow-hidden border-2 border-border bg-black shadow-inner"
        style={{ minHeight: isStarted ? "auto" : "280px" }}
      />

      {cameras.length > 0 && !isStarted && (
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Select Camera
        </p>
      )}

      {cameras.length > 1 && (
        <div className="flex gap-2 flex-wrap justify-center overflow-x-auto pb-1 max-w-full">
          {cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => switchCamera(cam.id)}
              className={`text-[10px] whitespace-nowrap px-3 py-1.5 rounded-full border transition-all ${
                selectedCamera === cam.id
                  ? "bg-gold text-gold-foreground border-gold shadow-sm font-bold scale-105"
                  : "bg-muted text-muted-foreground border-border hover:border-gold/30"
              }`}
            >
              {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {!isStarted ? (
          <button
            onClick={startScanner}
            disabled={!selectedCamera}
            className="px-8 py-3 bg-gold text-gold-foreground font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-gold/90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
          >
            <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
            Launch Scanner
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={stopScanner}
              className="px-6 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 font-semibold rounded-lg hover:bg-destructive/20 active:scale-95 transition-all"
            >
              Stop
            </button>
            <button
              onClick={refreshCameras}
              className="px-4 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/80 active:scale-95 transition-all"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrScannerComponent;
