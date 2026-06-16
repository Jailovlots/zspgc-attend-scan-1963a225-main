import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress benign Chrome video element play() interruption exceptions when unmounting/toggling camera scanner
window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || '';
    if (message.includes('play()') && message.includes('interrupted')) {
        console.warn('[Suppress] Suppressed video play interruption rejection:', event.reason);
        event.preventDefault();
        event.stopPropagation();
    }
});

console.log("AttendWise application initializing...");
try {
    const rootElement = document.getElementById("root");
    if (!rootElement) throw new Error("Root element not found!");
    createRoot(rootElement).render(<App />);
    console.log("AttendWise application rendered successfully.");
} catch (error) {
    console.error("AttendWise initialization error:", error);
}
