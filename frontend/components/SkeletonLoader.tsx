"use client";

import { Card } from "@/components/ui/card";

export const StatsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-6 bg-gradient-to-br from-card to-primary/5 border-border/40">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
              <div className="h-8 w-16 bg-muted/50 rounded animate-pulse" />
              <div className="h-3 w-32 bg-muted/50 rounded animate-pulse" />
            </div>
            <div className="rounded-full bg-muted/50 p-3 w-12 h-12 animate-pulse" />
          </div>
        </Card>
      ))}
    </div>
  );
};

export const TimelineSkeleton = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-48 bg-muted/50 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-muted/50 rounded animate-pulse" />
        </div>
      </div>

      <div className="relative space-y-4">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-muted/30" />

        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="relative ml-16 p-6 bg-card border-border/40 opacity-60"
          >
            <div className="absolute -left-[52px] top-6 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-muted/50">
              <div className="h-4 w-4 bg-muted/50 rounded animate-pulse" />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-32 bg-muted/50 rounded animate-pulse" />
                  <div className="h-5 w-5 bg-muted/50 rounded-full animate-pulse" />
                </div>

                <div className="space-y-2">
                  <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-muted/50 rounded animate-pulse" />
                </div>
              </div>

              <div className="h-9 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton = () => {
  return (
    <Card className="p-6 bg-gradient-to-br from-card to-primary/5 border-primary/20">
      <div className="mb-6">
        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-muted/50 rounded animate-pulse" />
      </div>
      <div className="h-[300px] bg-muted/30 rounded animate-pulse" />
    </Card>
  );
};

