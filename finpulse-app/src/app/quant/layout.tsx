import BottomNav from "@/components/BottomNav";

export default function QuantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
