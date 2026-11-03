import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* Room for the fixed bottom navigation (56px tab + the phone's gesture bar). */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
