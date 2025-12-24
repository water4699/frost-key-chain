"use client";

import { Shield } from "lucide-react";
import { useEffect, useState } from "react";

export function Footer() {
  const [integrityStamp, setIntegrityStamp] = useState("");

  useEffect(() => {
    const generateStamp = () => {
      const timestamp = new Date().toISOString();
      const random = Math.random().toString(36).substring(2, 15);
      return `TEMP-${timestamp.split("T")[0]}-${random.toUpperCase()}`;
    };

    setIntegrityStamp(generateStamp());

    // Update stamp every 30 seconds
    const interval = setInterval(() => {
      setIntegrityStamp(generateStamp());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            &copy; 2024 ColdChain FHE. Built with FHEVM technology.
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Powered by</span>
            <span className="font-semibold text-primary">Zama FHE</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">Temperature Integrity Stamp</span>
              <code className="text-xs font-mono text-primary">{integrityStamp}</code>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
