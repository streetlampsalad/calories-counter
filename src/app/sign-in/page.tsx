import { Suspense } from "react";
import { sanitizeNext } from "@/lib/auth/redirect";
import { SignInForm } from "./sign-in-form";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

async function SignInContent({
  searchParams,
}: {
  searchParams: PageProps<"/sign-in">["searchParams"];
}) {
  const params = await searchParams;
  return (
    <SignInForm
      next={sanitizeNext(first(params.next))}
      error={first(params.error)}
      email={first(params.email)}
    />
  );
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-semibold text-3xl tracking-tight">
          Calories Counter
        </h1>
        <p className="text-muted-foreground">
          Track what you eat, one tap at a time.
        </p>
      </div>
      <Suspense fallback={<div className="h-12" />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
