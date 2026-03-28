import RecordingOverlay from "./components/RecordingOverlay";
import SettingsPanel from "./components/SettingsPanel";

function App() {
  // Tauri loads different windows at different URLs
  // overlay window loads "/" and settings window loads "/settings.html"
  const isSettings = window.location.pathname.includes("settings");

  if (isSettings) {
    return <SettingsPanel />;
  }

  return <RecordingOverlay />;
}

export default App;
