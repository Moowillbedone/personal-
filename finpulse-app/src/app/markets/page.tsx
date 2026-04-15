import BottomNav from "@/components/BottomNav";
import MarketsClient from "./MarketsClient";
import { fetchCoins, fetchStocks } from "@/lib/api";

export const revalidate = 60; // ISR: 60초마다 실시간 가격 갱신

export default async function Markets() {
  const [coins, stocks] = await Promise.all([fetchCoins(), fetchStocks()]);
  return (
    <>
      <MarketsClient coins={coins} stocks={stocks} />
      <BottomNav />
    </>
  );
}
