import { redirect } from "next/navigation";

export default function DeliveriesRedirectPage() {
  redirect("/webhooks/deliveries");
}
