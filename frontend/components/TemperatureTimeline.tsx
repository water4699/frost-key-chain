"use client";

import { Lock, Unlock, Thermometer, CheckCircle2, AlertTriangle, MapPin, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useState } from "react";
import type { TemperatureLog } from "@/hooks/useColdChainTracker";

interface TemperatureTimelineProps {
  logs: TemperatureLog[];
  decryptTemperature: (logId: number) => Promise<void>;
  canDecrypt: boolean;
  isDecrypting: boolean;
}

export const TemperatureTimeline = ({ logs, decryptTemperature, canDecrypt }: TemperatureTimelineProps) => {
  const { isConnected } = useAccount();
  const [unlocking, setUnlocking] = useState<number | null>(null);

  const handleViewData = async (log: TemperatureLog) => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!canDecrypt) {
      toast.error("Contract not ready. Please wait...");
      return;
    }

    // Only decrypt if not already decrypted
    if (!log.decryptedTemperature) {
      setUnlocking(log.id);
      try {
        await decryptTemperature(log.id);
        
        toast.success("Temperature data decrypted", {
          description: `Data decrypted for ${log.location}`,
        });
      } catch (err) {
        toast.error("Failed to decrypt temperature data", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setUnlocking(null);
      }
    }
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <Thermometer className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Temperature Logs Yet</h3>
        <p className="text-muted-foreground">
          Record your first temperature reading to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Temperature Timeline
          </h2>
          <p className="text-muted-foreground mt-1">
            Encrypted cold chain monitoring logs
          </p>
        </div>
        {!isConnected && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/10 border border-warning/20">
            <Lock className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-warning">Connect wallet to view data</span>
          </div>
        )}
      </div>

      <div className="relative space-y-4">
        {/* Timeline line with animated gradient */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-secondary to-primary/20 animate-pulse" />

        {logs.map((log, index) => (
          <Card
            key={log.id}
            className={`relative ml-16 p-6 transition-all duration-500 hover:scale-[1.02] transform ${
              !log.decryptedTemperature
                ? "bg-card border-border/40 opacity-60 hover:opacity-80"
                : log.isWarning
                ? "bg-gradient-to-br from-card to-orange-500/10 border-orange-500/30 shadow-lg hover:shadow-xl hover:border-orange-500/50"
                : "bg-gradient-to-br from-card to-primary/5 border-primary/30 shadow-lg hover:shadow-xl hover:border-primary/50"
            }`}
            style={{
              animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
            }}
          >
            {/* Timeline node with pulse animation */}
            <div
              className={`absolute -left-[52px] top-6 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 transition-all duration-300 ${
                log.isWarning 
                  ? "border-orange-500 shadow-orange-500/50" 
                  : "border-primary shadow-primary/50"
              } ${log.decryptedTemperature ? "shadow-lg animate-pulse" : ""}`}
            >
              <Thermometer className={`h-4 w-4 transition-all duration-300 ${
                log.isWarning ? "text-orange-500" : "text-primary"
              }`} />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg">{log.cargo}</h3>
                  {!log.isWarning ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  )}
                </div>

                {!log.decryptedTemperature ? (
                  <div className="space-y-2 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span className="text-sm font-medium">Encrypted Data - Authorization Required</span>
                    </div>
                    <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-muted/50 rounded animate-pulse" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Thermometer
                          className={`h-6 w-6 ${log.isWarning ? "text-orange-500" : "text-primary"}`}
                        />
                        <span
                          className={`text-3xl font-bold font-mono ${
                            log.isWarning ? "text-orange-500" : "text-primary"
                          }`}
                        >
                          {log.decryptedTemperature}°C
                        </span>
                      </div>
                      {log.isWarning && (
                        <span className="px-2 py-1 text-xs font-semibold bg-orange-500/20 text-orange-600 rounded-full border border-orange-500/30">
                          OUT OF RANGE
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{log.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(log.timestamp * 1000).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{log.cargo}</span>
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant={!log.decryptedTemperature ? "default" : "secondary"}
                size="sm"
                onClick={() => handleViewData(log)}
                className="flex items-center gap-2 transition-all duration-300"
                disabled={!isConnected || !canDecrypt || unlocking === log.id || !!log.decryptedTemperature}
              >
                {unlocking === log.id ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Decrypting...
                  </>
                ) : !log.decryptedTemperature ? (
                  <>
                    <Unlock className="h-4 w-4" />
                    View Data
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Decrypted
                  </>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
