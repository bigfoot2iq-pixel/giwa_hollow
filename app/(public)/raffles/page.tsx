import { redirect } from "next/navigation";

// Raffles are hidden for now. The route stays in place so old links resolve
// cleanly, while the implementation remains under components/raffle for
// whenever the feature is brought back.
export default function RafflesPage() {
  redirect("/home");
}
