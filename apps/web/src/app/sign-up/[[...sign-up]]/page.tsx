import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (process.env.LOCAL_DEV === "true") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp />
    </div>
  );
}
