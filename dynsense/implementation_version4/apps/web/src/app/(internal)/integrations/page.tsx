"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Integration {
  id: string;
  provider: string;
  enabled: boolean;
  config: unknown;
  channelMapping: unknown;
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
  { key: "github", label: "GitHub", description: "Link commits and PRs to tasks. Auto-transition on merge." },
  { key: "slack", label: "Slack", description: "Receive AI nudges, status reports, and use slash commands." },
  { key: "teams", label: "Microsoft Teams", description: "Get notifications and AI summaries in Teams channels." },
] as const;

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getIntegrations(),
      api.getIntegrationEvents({ limit: 20 }),
    ]).then(([intRes, evtRes]) => {
      setIntegrations(intRes.data);
      setEvents(evtRes.data);
    }).finally(() => setLoading(false));
  }, []);

  async function toggleIntegration(provider: string, currentEnabled: boolean) {
    await api.upsertIntegration({ provider, enabled: !currentEnabled });
    const res = await api.getIntegrations();
    setIntegrations(res.data);
  }

  const getIntegration = (provider: string) =>
    integrations.find((i) => i.provider === provider);

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

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PROVIDERS.map((provider) => {
          const integration = getIntegration(provider.key);
          const isEnabled = integration?.enabled ?? false;

          return (
            <div key={provider.key} className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{provider.label}</h3>
                <button
                  onClick={() => toggleIntegration(provider.key, isEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    isEnabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      isEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-500">{provider.description}</p>
              <div className="text-xs text-gray-400">
                {integration ? `Connected ${new Date(integration.createdAt).toLocaleDateString()}` : "Not configured"}
              </div>
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
