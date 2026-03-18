import { redirect } from "next/navigation";

export default function LegacyResolveRedirectPage() {
  redirect("/resolution/by-recipient");
}
