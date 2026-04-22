import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  // In production, check auth here
  // For now, redirect to dashboard
  return <Dashboard />;
}