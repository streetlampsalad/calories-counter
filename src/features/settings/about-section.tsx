export function AboutSection({ version }: { version: string }) {
  return (
    <section aria-labelledby="about-heading" className="flex flex-col gap-3">
      <h2 id="about-heading" className="font-medium text-lg">
        About
      </h2>
      <p className="text-muted-foreground text-sm">Version {version}</p>

      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm">Food data</h3>
        <p className="text-muted-foreground text-sm">
          Australian food data comes from the Australian Food Composition
          Database, © Food Standards Australia New Zealand. Packaged product
          data comes from{" "}
          <a
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open Food Facts
          </a>
          , available under the Open Database Licence.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-sm">Photos and best guesses</h3>
        <p className="text-muted-foreground text-sm">
          When you scan handwritten notes or ask for a best guess, the photo or
          text is sent to Google's Gemini API on its free tier. Google may use
          content sent on the free tier to improve Google's products, so only
          scan notes you are happy to share.
        </p>
      </div>
    </section>
  );
}
