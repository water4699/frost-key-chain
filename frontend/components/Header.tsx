"use client";

import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Shield, Thermometer, Key } from "lucide-react";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 relative animate-fade-in-up">
            <Image 
              src="/logo.png" 
              alt="ColdChain Logo" 
              fill
              sizes="48px"
              className="object-contain transition-transform duration-300 hover:scale-110"
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent animate-fade-in-up">
              Secure ColdChain Tracker
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Encrypted Temperature Monitoring with FHE
            </p>
          </div>
        </div>
        <div className="animate-slide-in-right">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
};
