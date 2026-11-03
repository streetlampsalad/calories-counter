import { Suspense } from "react";
import { FoodsScreen } from "@/features/foods/foods-screen";

export default function FoodsPage() {
  return (
    <Suspense>
      <FoodsScreen />
    </Suspense>
  );
}
