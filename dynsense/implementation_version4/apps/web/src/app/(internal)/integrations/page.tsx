"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Integration {
  id: string;
  provider: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  channelMapping: Record<string, string> | null;
  createdAt: string;
}

interface IntegrationEvent {
  id: string;
  provider: string;
  eventType: string;
  taskId: string | null;
  createdAt: string;
}

const PROVIDERS = [
  {
    key: "github",
    label: "GitHub",
    description: "Link commits and PRs to tasks. Auto-transition on merge.",
    oauthUrl: "/api/v1/github/install",
    configFields: ["repositories"],
  },
  {
    key: "slack",
    label: "Slack",
    description: "Receive AI nudges, status reports, and use slash commands.",
    oauthUrl: "/api/v1/slack/oauth/start",
    configFields: ["teamName", "botUserId"],
  },
  {
    key: "teams",
    label: "Microsoft Teams",
    description: "Get notifications and AI summaries in Teams channels.",
    oauthUrl: null,
    configFields: [],
  },
] as const;

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getIntegrations(),
      api.getIntegrationEvents({ limit: 20 }),
    ]).then(([intRes, evtRes]) => {
      setIntegrations(intRes.data);
      setEvents(evtRes.data);
    }).catch(() => setError("Failed to load integrations"))
      .finally(() => setLoading(false));
  }, []);

  const toggleIntegration = useCallback(async (provider: string, currentEnabled: boolean) => {
    setSavingProvider(provider);
    try {
      await api.upsertIntegration({ provider, enabled: !currentEnabled });
      const res = await api.getIntegrations();
      setIntegrations(res.data);
    } catch {
      setError("Failed to toggle integration");
    } finally {
      setSavingProvider(null);
    }
  }, []);

  const handleDisconnect = useCallback(async (provider: string) => {
    if (!confirm(`Disconnect ${provider}? This will disable the integration.`)) return;
    setSavingProvider(provider);
    try {
      await api.upsertIntegration({ provider, enabled: false, config: {} });
      const res = await api.getIntegrations();
      setIntegrations(res.data);
    } catch {
      setError("Failed to disconnect");
    } finally {
      setSavingProvider(null);
    }
  }, []);

  const getIntegration = (provider: string) =>
    integrations.find((i) => i.provider === provider);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/v1/github/webhook`
    : "/api/v1/github/webhook";

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Integrations</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Integrations</h1>
        <p className="text-xs text-gray-500 mt-1">Connect external services to Dynsense</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Provider Cards */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const integration = getIntegration(provider.key);
          const isEnabled = integration?.enabled ?? false;
          const isExpanded = expandedProvider === provider.key;
          const isSaving = savingProvider === provider.key;
          const config = (integration?.config ?? {}) as Record<string, unknown>;
          const hasToken = !!(config.accessToken || config.installationId);

          return (
            <div key={provider.key} className="bg-white rounded-lg border overflow-hidden">
              {/* Card header */}
              <div className="p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      isEnabled && hasToken ? "bg-green-500" :
                      isEnabled ? "bg-yellow-400" : "bg-gray-300"
                    }`} />
                    <h3 className="text-sm font-medium">{provider.label}</h3>
                    {isEnabled && hasToken && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Connected</span>
                    )}
                    {isEnabled && !hasToken && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Enabled (not configured)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{provider.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Connect / Disconnect buttons */}
                  {provider.oauthUrl && !hasToken && (
                    <a
                      href={provider.oauthUrl}
                      className="text-xs px-3 py-1.5 font-medium text-white bg-ai rounded-md hover:bg-ai/90"
                    >
                      Connect
                    </a>
                  )}
                  {hasToken && (
                    <button
                      onClick={() => handleDisconnect(provider.key)}
                      disabled={isSaving}
                      className="text-xs px-3 py-1.5 font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}

                  {/* Enable toggle */}
                  <button
                    onClick={() => toggleIntegration(provider.key, isEnabled)}
                    disabled={isSaving}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isEnabled ? "bg-green-500" : "bg-gray-300"
                    } ${isSaving ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        isEnabled ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>

                  {/* Expand config */}
                  <button
                    onClick={() => setExpandedProvider(isExpanded ? null : provider.key)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                  >
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded config panel */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4 space-y-3">
                  {/* Connection details */}
                  {hasToken && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-600">Connection Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {config.teamId != null && (
                          <div><span className="text-gray-400">Team ID:</span> <span className="font-mono text-gray-700">{String(config.teamId)}</span></div>
                        )}
                        {config.teamName != null && (
                          <div><span className="text-gray-400">Team:</span> <span className="text-gray-700">{String(config.teamName)}</span></div>
                        )}
                        {config.installationId != null && (
                          <div><span className="text-gray-400">Installation:</span> <span className="font-mono text-gray-700">{String(config.installationId)}</span></div>
                        )}
                        {config.installedAt != null && (
                          <div><span className="text-gray-400">Connected:</span> <span className="text-gray-700">{new Date(String(config.installedAt)).toLocaleDateString()}</span></div>
                        )}
                        {config.scope != null && (
                          <div className="col-span-2"><span className="text-gray-400">Scopes:</span> <span className="font-mono text-gray-600 text-[10px]">{String(config.scope)}</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Webhook URL for GitHub */}
                  {provider.key === "github" && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600">Webhook URL</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          readOnly
                          value={webhookUrl}
                          className="flex-1 text-[10px] font-mono bg-white border rounded px-2 py-1 text-gray-600"
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(webhookUrl)}
                          className="text-[10px] px-2 py-1 text-ai border border-ai/20 rounded hover:bg-ai/10"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Add this URL to your GitHub repository webhook settings.</p>
                    </div>
                  )}

                  {/* Channel mapping for Slack */}
                  {provider.key === "slack" && integration?.channelMapping && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600">Channel Mapping</h4>
                      <div className="text-xs text-gray-500 mt-1">
                        {Object.entries(integration.channelMapping).length === 0
                          ? "No channels mapped. Summaries will go to #general."
                          : Object.entries(integration.channelMapping).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-gray-400">{key}:</span>
                              <span className="font-mono">{value}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {/* Not configured message */}
                  {!hasToken && (
                    <p className="text-xs text-gray-400">
                      {provider.oauthUrl
                        ? "Click 'Connect' above to set up this integration."
                        : "This integration is not yet available."}
                    </p>
                  )}

                  <div className="text-[10px] text-gray-400">
                    {integration ? `Created ${new Date(integration.createdAt).toLocaleDateString()}` : "Not configured"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Events */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Recent Events</h2>
        {events.length === 0 ? (
          <p className="text-xs text-gray-500">No integration events yet. Events will appear here when webhooks are received.</p>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {events.map((event) => (
              <div key={event.id} className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    event.provider === "github" ? "bg-gray-800" :
                    event.provider === "slack" ? "bg-purple-500" : "bg-blue-500"
                  }`} />
                  <span className="text-xs font-medium">{event.provider}</span>
                  <span className="text-xs text-gray-500">{event.eventType}</span>
                  {event.taskId && (
                    <span className="text-[10px] text-ai font-mono">TASK-{event.taskId.slice(0, 8)}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
