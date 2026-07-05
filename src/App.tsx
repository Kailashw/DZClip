import React, { useEffect, useState } from "react";
import MainApp from "./components/MainApp";
import Onboarding from "./components/Onboarding";
import { getTokens } from "./theme";
import type { Settings } from "../electron/types";

type Screen = "loading" | "onboarding" | "main";

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    window.clipvault.getPlatform().then((p) => setIsMac(p === "darwin"));
    window.clipvault.getSettings().then((s) => {
      setSettings(s);
      setScreen(s.hasOnboarded ? "main" : "onboarding");
    });
    // Keep settings in sync when changed from the Preferences window.
    const unsub = window.clipvault.onSettingsUpdated((s) => setSettings(s));
    return unsub;
  }, []);

  async function updateSettings(partial: Partial<Settings>) {
    const next = await window.clipvault.setSettings(partial);
    setSettings(next);
  }

  if (!settings || screen === "loading") return null;

  const isDark = settings.theme === "dark";
  const t = getTokens(isDark);

  return (
    <div className="w-screen h-screen p-2">
      {screen === "onboarding" && (
        <Onboarding
          t={t}
          isMac={isMac}
          shortcut={settings.shortcut}
          onFinish={() => {
            updateSettings({ hasOnboarded: true });
            setScreen("main");
          }}
          onClose={settings.hasOnboarded ? () => setScreen("main") : undefined}
        />
      )}
      {screen === "main" && (
        <MainApp
          t={t}
          isMac={isMac}
          settings={settings}
          onSettingsChange={updateSettings}
          onGuide={() => setScreen("onboarding")}
          onPreferences={() => window.clipvault.openPreferences()}
        />
      )}
    </div>
  );
}
