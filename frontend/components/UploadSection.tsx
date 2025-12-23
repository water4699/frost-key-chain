"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UploadSectionProps {
  onUpload: () => Promise<void>;
  recordTemperature: (location: string, cargo: string, temperature: number, isWarning: boolean) => Promise<void>;
  isRecording: boolean;
}

export const UploadSection = ({ onUpload, recordTemperature, isRecording }: UploadSectionProps) => {
  const { isConnected } = useAccount();
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState({
    temperature: "",
    location: "",
    cargo: "",
    status: "normal" as "normal" | "warning",
  });

  const handleManualUpload = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
    };

    if (!formData.temperature || !formData.location || !formData.cargo) {
      toast.error("Please fill in all fields");
      return;
    }

    const temp = parseFloat(formData.temperature);
    if (isNaN(temp)) {
      toast.error("Invalid temperature value");
      return;
    }

    try {
      const isWarning = formData.status === "warning";
      
      await recordTemperature(
        formData.location,
        formData.cargo,
        temp,
        isWarning
      );

      toast.success("Temperature record uploaded", {
        description: `${temp}°C recorded at ${formData.location}`,
      });

      setFormData({ temperature: "", location: "", cargo: "", status: "normal" });
      setIsOpen(false);
      
      // Reload logs after successful upload
      await onUpload();
    } catch (error) {
      toast.error("Failed to upload temperature record", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          <Plus className="h-5 w-5 mr-2" />
          <span className="hidden sm:inline">Record Temperature</span>
          <span className="sm:hidden">Record</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] animate-slide-in-right">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Record Temperature Reading
          </DialogTitle>
          <DialogDescription className="text-sm">
            Add a new temperature log for cold chain monitoring. Data will be encrypted on-chain using FHE technology.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature (°C)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  placeholder="e.g., -18.5"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  disabled={isRecording}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "normal" | "warning") => setFormData({ ...formData, status: value })}
                  disabled={isRecording}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Shanghai Port"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                disabled={isRecording}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo Description</Label>
              <Input
                id="cargo"
                placeholder="e.g., Frozen Seafood - 500kg"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                disabled={isRecording}
              />
            </div>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-start gap-3">
                <Upload className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">FHE Encryption</p>
                  <p className="text-xs text-muted-foreground">
                    Temperature data will be encrypted using Fully Homomorphic Encryption (FHE) and stored on-chain. Only authorized parties can decrypt it.
                  </p>
                </div>
              </div>
            </Card>

            <Button 
              onClick={handleManualUpload} 
              className="w-full" 
              disabled={!isConnected || isRecording || !formData.temperature || !formData.location || !formData.cargo}
            >
              {isRecording ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Recording & Encrypting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Record Temperature
                </>
              )}
            </Button>
          </div>

          {!isConnected && (
            <p className="text-sm text-warning text-center">Connect your wallet to record temperature data</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
