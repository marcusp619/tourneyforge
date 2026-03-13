import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center px-4">
      <p className="text-5xl font-black text-green-700">404</p>
      <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="text-gray-500">This dashboard page doesn&apos;t exist.</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
