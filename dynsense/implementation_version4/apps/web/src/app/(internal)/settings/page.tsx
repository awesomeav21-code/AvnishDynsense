"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface FeatureFlag {
  enabled: boolean;
  metadata: Record<string, unknown>;
}

const DEFAULT_FLAGS = [
  { key: "risk_predictor", label: "Risk Predictor", description: "AI-powered risk prediction for projects" },
  { key: "scope_detector", label: "Scope Creep Detector", description: "Detect scope creep against WBS baseline" },
  { key: "ai_pm_agent", label: "AI PM Agent", description: "Autonomous 15-min agent loops with nudges" },
  { key: "recurring_tasks", label: "Recurring Tasks", description: "Auto-create tasks on daily/weekly/monthly schedule" },
  { key: "sso_saml", label: "SSO (SAML 2.0)", description: "Enterprise single sign-on via SAML" },
  { key: "mfa_totp", label: "MFA (TOTP)", description: "Multi-factor authentication with authenticator app" },
  { key: "client_portal", label: "Client Portal", description: "Read-only client view of projects" },
];

export default function SettingsPage() {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"features" | "security" | "ai">("features");

  useEffect(() => {
    api.getFeatureFlags()
      .then((res) => setFlags(res.data))
      .catch(() => setError("Failed to load feature flags"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFlag(key: string) {
    setTogglingKey(key);
    setError("");
    const current = flags[key]?.enabled ?? false;
    setFlags((prev) => ({
      ...prev,
      [key]: { enabled: !current, metadata: prev[key]?.metadata ?? {} },
    }));
    try {
      await api.upsertFeatureFlag({ key, enabled: !current });
    } catch (err) {
      setFlags((prev) => ({
        ...prev,
        [key]: { enabled: current, metadata: prev[key]?.metadata ?? {} },
      }));
      const msg = err instanceof Error && err.message.includes("Missing permission")
        ? "You don't have permission to change feature flags. Contact an Admin or PM."
        : "Failed to update feature flag.";
      setError(msg);
    } finally {
      setTogglingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Settings</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Settings</h1>
        <p className="text-xs text-gray-500 mt-1">Manage feature flags, security, and AI configuration</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["features", "security", "ai"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "features" ? "Feature Flags" : tab === "security" ? "Security" : "AI Configuration"}
          </button>
        ))}
      </div>

      {/* Feature Flags Tab */}
      {activeTab === "features" && (
        <div className="space-y-2">
          {DEFAULT_FLAGS.map((flag) => {
            const isEnabled = flags[flag.key]?.enabled ?? false;
            const isToggling = togglingKey === flag.key;
            return (
              <div key={flag.key} className="bg-white rounded-lg border px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">{flag.label}</div>
                  <div className="text-xs text-gray-500">{flag.description}</div>
                </div>
                <button
                  onClick={() => toggleFlag(flag.key)}
                  disabled={isToggling}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    isEnabled ? "bg-green-500" : "bg-gray-300"
                  } ${isToggling ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      isEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">SSO Configuration (SAML 2.0 / OIDC)</h3>
            <p className="text-xs text-gray-500">
              Configure enterprise single sign-on with Okta, Azure AD, or Google Workspace.
              Enable the SSO feature flag first, then configure your identity provider below.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">IdP Entity ID</label>
                <input type="text" placeholder="https://idp.example.com/entity" className="w-full text-xs border rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">SSO URL</label>
                <input type="text" placeholder="https://idp.example.com/sso" className="w-full text-xs border rounded px-2 py-1.5" />
              </div>
            </div>
            <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
              Save SSO Configuration
            </button>
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">Multi-Factor Authentication (TOTP)</h3>
            <p className="text-xs text-gray-500">
              Require TOTP-based MFA for all users. Users will set up their authenticator app on next login.
            </p>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${flags["mfa_totp"]?.enabled ? "bg-green-500" : "bg-gray-400"}`} />
              <span className="text-xs">{flags["mfa_totp"]?.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">Session Management</h3>
            <p className="text-xs text-gray-500">
              Configure session limits, device fingerprinting, and IP pinning.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Max Concurrent Sessions</label>
                <input type="number" defaultValue={5} className="w-full text-xs border rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Session Timeout (hours)</label>
                <input type="number" defaultValue={24} className="w-full text-xs border rounded px-2 py-1.5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Configuration Tab */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">AI Cost Dashboard</h3>
            <p className="text-xs text-gray-500">Per-capability token consumption and cost tracking.</p>
            <div className="grid grid-cols-4 gap-3">
              {["wbs_generator", "whats_next", "summary_writer", "risk_predictor"].map((cap) => (
                <div key={cap} className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-xs font-medium">{cap.replace(/_/g, " ")}</div>
                  <div className="text-lg font-bold text-blue-600 mt-1">--</div>
                  <div className="text-xs text-gray-400">tokens</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">Autonomy Configuration</h3>
            <p className="text-xs text-gray-500">
              Control AI autonomy mode per capability. Shadow mode logs but never acts.
              Propose mode requires human approval. Execute mode acts immediately.
            </p>
            <div className="space-y-2">
              {["wbs_generator", "whats_next", "nl_query", "summary_writer", "risk_predictor", "ai_pm_agent"].map((cap) => (
                <div key={cap} className="flex items-center justify-between py-1">
                  <span className="text-xs">{cap.replace(/_/g, " ")}</span>
                  <select className="text-xs border rounded px-2 py-1" defaultValue="propose">
                    <option value="shadow">Shadow</option>
                    <option value="propose">Propose</option>
                    <option value="execute">Execute</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
