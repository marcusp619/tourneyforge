import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (process.env.LOCAL_DEV === "true") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn />
    </div>
  );
}
