import { redirect } from "next/navigation";

export const metadata = { title: "Platform Console | Bazion Web" };
export const dynamic = "force-dynamic";

export default function PlatformPage() {
  const platformConsoleUrl = process.env.PLATFORM_CONSOLE_URL;
  if (process.env.NODE_ENV === "production" && !platformConsoleUrl) {
    throw new Error("Set PLATFORM_CONSOLE_URL to the separately deployed Bazion platform console.");
  }
  redirect(platformConsoleUrl ?? "http://localhost:3001");
}
