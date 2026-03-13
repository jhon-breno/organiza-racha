import { redirect } from "next/navigation";
import { auth } from "@/auth";

type SearchParams = Promise<{
  callbackUrl?: string;
  status?: string;
  message?: string;
}>;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  const destination = new URLSearchParams();
  destination.set("tab", "signup");
  destination.set("callbackUrl", callbackUrl);

  if (params.status) {
    destination.set("status", params.status);
  }

  if (params.message) {
    destination.set("message", params.message);
  }

  redirect(`/auth/signin?${destination.toString()}`);
}
