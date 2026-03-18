import { redirect } from "next/navigation";

export default function LegacyVerifyRedirectPage() {
  redirect("/resolution/verify-transfer");
}
