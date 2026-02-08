import { currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { ScriptUpload } from "./components/ScriptUpload";
import { ScriptList } from "./components/ScriptList";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">SceneBuddy AI</h1>
          <SignOutButton>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-colors font-medium">
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome, {user.firstName || user.emailAddresses[0]?.emailAddress}!
            </h2>
            <p className="text-gray-600">
              Upload a script, choose your character, and start rehearsing with your AI scene partner.
            </p>
          </div>

          <ScriptUpload />
          <ScriptList />
        </div>
      </main>
    </div>
  );
}
