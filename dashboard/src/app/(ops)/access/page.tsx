import { redirect } from "next/navigation";

export default function AccessRedirectPage() {
  redirect("/access/api-keys");
}
