import { redirect } from "next/navigation";

/** The former virtual-trading screen now points to the live tBNB/tUSDT agent. */
export default function TradingPage() {
  redirect("/dashboard/live-agent");
}
