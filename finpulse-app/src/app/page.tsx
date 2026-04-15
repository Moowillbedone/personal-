import BottomNav from "@/components/BottomNav";
import HomeClient from "./HomeClient";
import { fetchCoins, fetchStocks, fetchNews } from "@/lib/api";

export const revalidate = 60; // ISR: 60초마다 실시간 가격 갱신

export default async function Home() {
  const [coins, stocks, news] = await Promise.all([fetchCoins(), fetchStocks(), fetchNews()]);
  return (
    <>
      <HomeClient initialCoins={coins} stocks={stocks} initialNews={news} />
      <BottomNav />
    </>
  );
}
