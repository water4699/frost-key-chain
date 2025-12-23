"use client";

import { useState, useEffect } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import type { TemperatureLog } from "@/hooks/useColdChainTracker";

interface SearchAndFilterProps {
  logs: TemperatureLog[];
  onFilterChange: (filteredLogs: TemperatureLog[]) => void;
}

export const SearchAndFilter = ({ logs, onFilterChange }: SearchAndFilterProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "normal" | "warning">("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"time" | "temperature" | "location">("time");

  // Get unique locations
  const uniqueLocations = Array.from(new Set(logs.map((log) => log.location)));

  // Apply filters
  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.cargo.toLowerCase().includes(query) ||
          log.location.toLowerCase().includes(query) ||
          (log.decryptedTemperature !== undefined &&
            log.decryptedTemperature.toString().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((log) =>
        statusFilter === "warning" ? log.isWarning : !log.isWarning
      );
    }

    // Location filter
    if (locationFilter !== "all") {
      filtered = filtered.filter((log) => log.location === locationFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "time":
          return b.timestamp - a.timestamp;
        case "temperature":
          const tempA = a.decryptedTemperature ?? -999;
          const tempB = b.decryptedTemperature ?? -999;
          return tempB - tempA;
        case "location":
          return a.location.localeCompare(b.location);
        default:
          return 0;
      }
    });

    onFilterChange(filtered);
  };

  // Apply filters when any filter changes
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter, locationFilter, sortBy, logs]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleStatusChange = (value: "all" | "normal" | "warning") => {
    setStatusFilter(value);
  };

  const handleLocationChange = (value: string) => {
    setLocationFilter(value);
  };

  const handleSortChange = (value: "time" | "temperature" | "location") => {
    setSortBy(value);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setLocationFilter("all");
    setSortBy("time");
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-card to-primary/5 border-primary/20">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by cargo, location, or temperature..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => handleSearchChange("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full md:w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>

        {/* Location Filter */}
        <Select value={locationFilter} onValueChange={handleLocationChange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {uniqueLocations.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full md:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="time">Sort by Time</SelectItem>
            <SelectItem value="temperature">Sort by Temp</SelectItem>
            <SelectItem value="location">Sort by Location</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {(searchQuery || statusFilter !== "all" || locationFilter !== "all") && (
          <Button variant="outline" onClick={clearFilters} className="whitespace-nowrap">
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
    </Card>
  );
};

