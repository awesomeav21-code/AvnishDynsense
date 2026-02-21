// Ref: design-doc §7.1 — Next.js 15 App Router shell
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Dynsense
        </h1>
        <p className="text-lg text-gray-600 max-w-md">
          AI-native project management for consultancy firms.
          The AI runs the project. The human supervises.
        </p>
        <div className="pt-4">
          <span className="inline-block px-3 py-1 text-xs font-medium bg-ai/10 text-ai rounded-full">
            R0-1 Infrastructure Complete
          </span>
        </div>
      </div>
    </main>
  );
}
