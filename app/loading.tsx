export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <nav className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <div className="h-6 w-24 bg-gray-100 rounded-lg animate-pulse" />
            <div className="hidden md:flex gap-8">
              <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12">
        {/* Title */}
        <div className="mb-12 space-y-3">
          <div className="h-10 w-48 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-5 w-80 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Tool cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg animate-pulse p-6 space-y-4 h-48" />
          ))}
        </div>
      </main>
    </div>
  );
}
