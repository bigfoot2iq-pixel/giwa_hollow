import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Your Sepolia ETH, ARIWA balance, and ARIWA NFT collection on GIWA Sepolia.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function ProfilePage() {
  return <ProfileView />;
}
