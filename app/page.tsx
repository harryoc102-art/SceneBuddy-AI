import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">SceneBuddy AI</h1>
          <div className="space-x-4">
            <Link
              href="/sign-in"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Your AI Scene Partner
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Upload any script, choose your character, and rehearse with a responsive AI voice partner. 
            Practice at your own pace with dramatic pauses, professional delivery, and real-time script tracking.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/sign-up"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Rehearsing Free
            </Link>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-3xl mb-4">📄</div>
            <h3 className="text-xl font-semibold mb-2">Upload Any Script</h3>
            <p className="text-gray-600">
              PDF, Final Draft, or plain text. Our AI parses scenes, characters, and dialogue automatically.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-3xl mb-4">🎭</div>
            <h3 className="text-xl font-semibold mb-2">Choose Your Character</h3>
            <p className="text-gray-600">
              Select who you want to play. The AI voices all other characters with natural, responsive delivery.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="text-3xl mb-4">🎬</div>
            <h3 className="text-xl font-semibold mb-2">Rehearse Your Way</h3>
            <p className="text-gray-600">
              Control the pace. Take dramatic pauses. See your script live on screen. Never feel rushed.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
