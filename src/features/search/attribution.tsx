// Credit for the food data, as its licences require. Shown under search results and in Settings → About,
// from one place so the two never say different things.
export function FoodDataAttribution({ className }: { className?: string }) {
  return (
    <p className={className}>
      Australian food data comes from the Australian Food Composition Database,
      © Food Standards Australia New Zealand. Packaged product data comes from{" "}
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
  );
}
