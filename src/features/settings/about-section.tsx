import { FoodDataAttribution } from "@/features/search/attribution";

export function AboutSection({
  version,
  tipsOn = false,
}: {
  version: string;
  /** Whether the Nutrition tips Toggle (feature-218) is on for this User. */
  tipsOn?: boolean;
}) {
  return (
    <section aria-labelledby="about-heading" className="flex flex-col gap-3">
      <h2 id="about-heading" className="font-medium text-lg">
        About
      </h2>
      <p className="text-muted-foreground text-sm">Version {version}</p>

      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm">Food data</h3>
        <FoodDataAttribution className="text-muted-foreground text-sm" />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm">Photos and best guesses</h3>
        <p className="text-muted-foreground text-sm">
          When you scan handwritten notes or ask for a best guess, the photo or
          text is sent to Google's Gemini API on its free tier. Google may use
          content sent on the free tier to improve Google's products, so only
          scan notes you are happy to share.
        </p>
        {tipsOn ? (
          <p className="text-muted-foreground text-sm">
            Getting Nutrition tips sends last week's Food names and Quantities
            to Google's Gemini API on its free tier.
          </p>
        ) : null}
      </div>
    </section>
  );
}
