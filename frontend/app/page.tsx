"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StatsCards } from "@/components/StatsCards";
import { TemperatureTimeline } from "@/components/TemperatureTimeline";
import { TemperatureChart } from "@/components/TemperatureChart";
import { SearchAndFilter } from "@/components/SearchAndFilter";
import { UploadSection } from "@/components/UploadSection";
import { StatsSkeleton, TimelineSkeleton, ChartSkeleton } from "@/components/SkeletonLoader";
import { Toaster } from "@/components/ui/sonner";
import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { useColdChainTracker } from "@/hooks/useColdChainTracker";
import { useMetaMask } from "@/hooks/metamask/useMetaMaskProvider";
import type { TemperatureLog } from "@/hooks/useColdChainTracker";

export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { provider: metaMaskProvider } = useMetaMask();

  // FHEVM instance
  const {
    instance: fhevmInstance,
  } = useFhevm({
    provider: metaMaskProvider,
    chainId,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
    enabled: isConnected,
  });

  // ColdChainTracker hook
  const coldChainTracker = useColdChainTracker({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    chainId,
  });

  // Load logs when contract is deployed and ready
  useEffect(() => {
    if (coldChainTracker.isDeployed && isConnected) {
      coldChainTracker.loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coldChainTracker.isDeployed, isConnected]);

  // Filtered logs state
  const [filteredLogs, setFilteredLogs] = useState<TemperatureLog[]>(coldChainTracker.logs);

  // Update filtered logs when original logs change
  useEffect(() => {
    setFilteredLogs(coldChainTracker.logs);
  }, [coldChainTracker.logs]);

  // Calculate stats based on filtered logs
  const activeShipments = filteredLogs.length;
  const avgTemperature = filteredLogs.length > 0 && filteredLogs.some(log => log.decryptedTemperature)
    ? Math.round(
        filteredLogs
          .filter(log => log.decryptedTemperature)
          .reduce((sum, log) => sum + (log.decryptedTemperature || 0), 0) / 
        filteredLogs.filter(log => log.decryptedTemperature).length
      )
    : -18;
  const alertCount = filteredLogs.filter(log => log.isWarning).length;

  return (
    <>
      <Toaster />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-7xl">
          {/* Stats Section */}
          <div className="mb-8 animate-fade-in-up">
            {coldChainTracker.isLoading ? (
              <StatsSkeleton />
            ) : (
              <StatsCards 
                activeShipments={activeShipments}
                avgTemperature={avgTemperature}
                alertCount={alertCount}
              />
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="w-full sm:w-auto">
              <SearchAndFilter 
                logs={coldChainTracker.logs}
                onFilterChange={setFilteredLogs}
              />
            </div>
            <UploadSection 
              onUpload={coldChainTracker.loadLogs}
              recordTemperature={coldChainTracker.recordTemperature}
              isRecording={coldChainTracker.isRecording}
            />
          </div>

          {/* Temperature Chart */}
          {coldChainTracker.isLoading ? (
            <div className="mb-8">
              <ChartSkeleton />
            </div>
          ) : filteredLogs.some(log => log.decryptedTemperature !== undefined) ? (
            <div className="mb-8 animate-slide-in-right">
              <TemperatureChart logs={filteredLogs} />
            </div>
          ) : null}

          {/* Temperature Timeline */}
          <div className="animate-fade-in-up">
            {coldChainTracker.isLoading ? (
              <TimelineSkeleton />
            ) : (
              <TemperatureTimeline 
                logs={filteredLogs}
                decryptTemperature={coldChainTracker.decryptTemperature}
                canDecrypt={coldChainTracker.canDecrypt}
                isDecrypting={coldChainTracker.isDecrypting}
              />
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
