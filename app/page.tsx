import { YaazhExperience } from "@/components/yaazh-experience";

type PreviewScreen = "landing" | "invite" | "lobby" | "player";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    return <YaazhExperience />;
  }

  const requested = (await searchParams).preview;
  const initialScreen: PreviewScreen =
    typeof requested === "string" && ["invite", "lobby", "player"].includes(requested)
      ? (requested as PreviewScreen)
      : "landing";

  return <YaazhExperience initialScreen={initialScreen} />;
}
