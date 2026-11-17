import { redirect } from "next/navigation";

// Raffles are hidden for now. Send old detail links back to the home page.
export default function RaffleDetailPage() {
  redirect("/home");
}
