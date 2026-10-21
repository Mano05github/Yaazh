import { YaazhExperience } from "@/components/yaazh-experience";

type PreviewScreen = "landing" | "invite" | "lobby" | "player";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[]; room?: string | string[] }>;
}) {
  const parameters = await searchParams;
  const requestedRoom = typeof parameters.room === "string" ? parameters.room : undefined;

  if (process.env.NODE_ENV !== "development") {
    return <YaazhExperience initialRoomCode={requestedRoom} />;
  }

  const requested = parameters.preview;
  const initialScreen: PreviewScreen =
    typeof requested === "string" && ["invite", "lobby", "player"].includes(requested)
      ? (requested as PreviewScreen)
      : "landing";

  return <YaazhExperience initialScreen={initialScreen} initialRoomCode={requestedRoom} />;
}
