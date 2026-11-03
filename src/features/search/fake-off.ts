// Stands in for Open Food Facts in tests, answering from a recorded response, so no test ever calls
// the real service. Switched on with OFF_SOURCE=fixture.
export const fakeOffFetch: typeof fetch = async () => {
  const recorded = (await import("./fixtures/off-tim-tam.json")).default;
  return Response.json(recorded);
};
