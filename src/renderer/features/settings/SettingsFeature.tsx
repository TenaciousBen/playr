import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { UserSettings } from "@/src/shared/models/userSettings";
import { DEFAULT_USER_SETTINGS } from "@/src/shared/models/userSettings";

function recentlyAddedLabel(r: UserSettings["recentlyAddedRange"]) {
  return r === "today"
    ? "Today"
    : r === "week"
      ? "Past Week"
      : r === "month"
        ? "Past Month"
        : r === "quarter"
          ? "Past Quarter"
          : "Past Year";
}

export function SettingsFeature() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await window.audioplayer.settings.get();
        if (alive) setSettings(s);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setAndPersist = useCallback(async (next: UserSettings) => {
    setSettings(next);
    setSaving(true);
    try {
      await window.audioplayer.settings.set(next);
    } finally {
      setSaving(false);
    }
  }, []);

  const statisticsLabel = useMemo(
    () => (settings.allowStatistics ? "enabled" : "disabled"),
    [settings.allowStatistics]
  );

  const onEmptyLibrary = useCallback(async () => {
    const ok = window.confirm(
      "Are you sure you want to empty your library?\n\nThis action cannot be undone and will remove all audiobooks, progress, and bookmarks."
    );
    if (!ok) return;
    await window.audioplayer.library.clear();
    window.dispatchEvent(new Event("audioplayer:library-changed"));
    window.alert("Library emptied successfully.");
  }, []);

  return (
    <section className="flex-1 overflow-y-auto">
      {/* Settings Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-400 mt-1">Configure your Audioplayer preferences</p>
      </div>

      {/* Settings Content */}
      <div className="px-8 py-6">
        {/* Library Management Section */}
        <div className="mb-10">
          <div className="border-b border-gray-700 pb-4 mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">Library Management</h3>
            <p className="text-sm text-gray-400">Manage your audiobook library and storage</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start justify-between py-4">
              <div className="flex-1">
                <h4 className="text-base font-medium text-white mb-1">Recently Added Range</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Choose which time window is shown in the Recently Added view.
                </p>
              </div>
              <div className="ml-8 flex-shrink-0">
                <select
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  value={settings.recentlyAddedRange}
                  disabled={loading || saving}
                  onChange={(e) =>
                    void setAndPersist({
                      ...settings,
                      recentlyAddedRange: e.target.value as UserSettings["recentlyAddedRange"]
                    })
                  }
                  aria-label={`Recently Added range ${recentlyAddedLabel(settings.recentlyAddedRange)}`}
                >
                  <option value="today">Today</option>
                  <option value="week">Past Week</option>
                  <option value="month">Past Month</option>
                  <option value="quarter">Past Quarter</option>
                  <option value="year">Past Year</option>
                </select>
              </div>
            </div>

            <div className="flex items-start justify-between py-4">
              <div className="flex-1">
                <h4 className="text-base font-medium text-white mb-1">Empty Library</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Remove all audiobooks from your library. This action cannot be undone and will clear all playback
                  progress and bookmarks.
                </p>
              </div>
              <div className="ml-8 flex-shrink-0">
                <button
                  onClick={() => void onEmptyLibrary()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-60"
                  disabled={loading}
                >
                  Empty Library
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Analytics Section */}
        <div className="mb-10">
          <div className="border-b border-gray-700 pb-4 mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">Privacy &amp; Analytics</h3>
            <p className="text-sm text-gray-400">Control data collection and usage analytics</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start justify-between py-4">
              <div className="flex-1">
                <h4 className="text-base font-medium text-white mb-1">Allow Collection of Statistics</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Help improve Audioplayer by sharing anonymous usage statistics. This includes playback patterns,
                  feature usage, and performance metrics. No personal data or audiobook content is collected.
                </p>
              </div>
              <div className="ml-8 flex-shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={!!settings.allowStatistics}
                    onChange={(e) =>
                      void setAndPersist({ ...settings, allowStatistics: e.target.checked })
                    }
                    disabled={loading || saving}
                    aria-label={`Statistics collection ${statisticsLabel}`}
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 peer-focus:ring-offset-gray-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder sections (as in design) */}
        <div className="mb-10">
          <div className="border-b border-gray-700 pb-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Playback Settings</h3>
            <p className="text-sm text-gray-500">Audio playback preferences (Coming soon)</p>
          </div>
        </div>

        <div className="mb-10">
          <div className="border-b border-gray-700 pb-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Appearance</h3>
            <p className="text-sm text-gray-500">Customize the look and feel (Coming soon)</p>
          </div>
        </div>

        <div className="mb-10">
          <div className="border-b border-gray-700 pb-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-500 mb-2">Keyboard Shortcuts</h3>
            <p className="text-sm text-gray-500">Configure hotkeys and shortcuts (Coming soon)</p>
          </div>
        </div>
      </div>
    </section>
  );
}


