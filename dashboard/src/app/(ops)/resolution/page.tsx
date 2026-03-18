import { redirect } from "next/navigation";

export default function ResolutionRedirectPage() {
  redirect("/resolution/by-recipient");
}
