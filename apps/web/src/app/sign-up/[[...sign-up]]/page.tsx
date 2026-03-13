import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (process.env.LOCAL_DEV === "true") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 px-4">
          <p className="text-2xl font-bold text-gray-900">Local Dev Mode</p>
          <p className="text-gray-500">Auth is bypassed. No sign-up required.</p>
          <Link
            href="/dashboard"
            className="inline-block bg-green-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-800"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp />
    </div>
  );
}
