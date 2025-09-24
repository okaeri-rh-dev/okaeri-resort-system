/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
/**
 * Advanced Search Hooks with TanStack Query Integration - PHASE 3-4
 *
 * Provides React hooks for search functionality with:
 * - Real-time search with debouncing
 * Note: Advanced features deferred to Phase 3-4
 * - Optimistic updates
 * - Intelligent caching strategies
 * - Background refetching
 * - Infinite scroll support
 */

import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchStore, searchSelectors, type SearchResult } from "@/stores/useSearchStore";
import type { Booking, Guest, Unit } from "@/types";
import { supabase, db, handleSupabaseError } from "@/lib/supabase";
import {
  processSearchResults,
  applyBookingFilters,
  fuzzySearchScore,
  type SearchField,
} from "@/utils/search-filter";
import { buildSupabaseQuery, type FilterBuilder } from "@/utils/filter-builder";

// ============================================
// UNIFIED SEARCH HOOK
// ============================================

interface UseUnifiedSearchOptions {
  enabled?: boolean;
  debounceMs?: number;
  maxResults?: number;
  minScore?: number;
  includeBookings?: boolean;
  includeGuests?: boolean;
  includeUnits?: boolean;
}

export function useUnifiedSearch(options: UseUnifiedSearchOptions = {}) {
  const {
    enabled = true,
    debounceMs = 300,
    maxResults = 100,
    minScore = 0.1,
    includeBookings = true,
    includeGuests = true,
    includeUnits = true,
  } = options;

  const {
    currentQuery,
    activeFilters,
    searchConfig,
    dateRangeFilter,
    workflowFilter,
    financialFilter,
    performSearch,
    getCachedResults,
    setCachedResults,
  } = useSearchStore();

  const queryClient = useQueryClient();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Build cache key
  const cacheKey = useMemo(() => {
    const filterKey = JSON.stringify({
      filters: Array.from(activeFilters.values()),
      dateRange: dateRangeFilter,
      workflow: workflowFilter,
      financial: financialFilter,
    });
    return `unified-search:${currentQuery.query}:${filterKey}`;
  }, [currentQuery.query, activeFilters, dateRangeFilter, workflowFilter, financialFilter]);

  const searchQuery = useQuery({
    queryKey: ["unified-search", cacheKey],
    queryFn: async () => {
      // Check cache first
      const filterKey = JSON.stringify(Array.from(activeFilters.values()));
      const cached = getCachedResults(currentQuery.query, filterKey);
      if (cached && searchConfig.enableCache) {
        return {
          bookings: cached.filter((r) => r.type === "booking"),
          guests: cached.filter((r) => r.type === "guest"),
          units: cached.filter((r) => r.type === "unit"),
        };
      }

      const results = {
        bookings: [] as SearchResult<Booking>[],
        guests: [] as SearchResult<Guest>[],
        units: [] as SearchResult<Unit>[],
      };

      // Parallel fetch all data types if query or filters exist
      if (currentQuery.query || activeFilters.size > 0) {
        const [bookingsData, guestsData, unitsData] = await Promise.all([
          includeBookings ? fetchAndSearchBookings() : Promise.resolve([]),
          includeGuests ? fetchAndSearchGuests() : Promise.resolve([]),
          includeUnits ? fetchAndSearchUnits() : Promise.resolve([]),
        ]);

        results.bookings = bookingsData;
        results.guests = guestsData;
        results.units = unitsData;

        // Cache combined results
        const allResults = [...bookingsData, ...guestsData, ...unitsData];
        setCachedResults(currentQuery.query, filterKey, allResults);
      }

      return results;
    },
    enabled: enabled && (!!currentQuery.query || activeFilters.size > 0),
    staleTime: 60000, // 1 minute
    refetchInterval: false, // Disable automatic refetching for search
  });

  // Debounced search trigger
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        performSearch(query);
      }, debounceMs);
    },
    [performSearch, debounceMs]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Helper functions for searching each data type
  async function fetchAndSearchBookings(): Promise<SearchResult<Booking>[]> {
    let query = supabase.from("bookings").select(`
      *,
      unit:units(*),
      guest:guests(*)
    `);

    // Apply filters
    const filters = Array.from(activeFilters.values());
    query = buildSupabaseQuery(query, filters);

    const { data, error } = await query;
    if (error) throw new Error(handleSupabaseError(error));

    const bookings = data || [];

    // Apply additional filters
    const filtered = applyBookingFilters(
      bookings,
      filters,
      dateRangeFilter,
      workflowFilter,
      financialFilter
    );

    // Process search results
    return processSearchResults(filtered, currentQuery.query, searchConfig.searchFields, {
      fuzzyMatch: currentQuery.fuzzyMatch,
      typoTolerance: currentQuery.typoTolerance,
      highlightResults: currentQuery.highlightResults,
      maxResults,
      minScore,
    });
  }

  async function fetchAndSearchGuests(): Promise<SearchResult<Guest>[]> {
    if (!currentQuery.query) return [];

    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .or(
        `guest_name.ilike.%${currentQuery.query}%,email.ilike.%${currentQuery.query}%,phone_number.ilike.%${currentQuery.query}%`
      );

    if (error) throw new Error(handleSupabaseError(error));

    const guestFields: SearchField[] = [
      { name: "guest_name", weight: 1.0, type: "text" },
      { name: "email", weight: 0.9, type: "email" },
      { name: "phone_number", weight: 0.7, type: "text" },
    ];

    return processSearchResults(data || [], currentQuery.query, guestFields, {
      fuzzyMatch: currentQuery.fuzzyMatch,
      typoTolerance: currentQuery.typoTolerance,
      highlightResults: currentQuery.highlightResults,
      maxResults: Math.floor(maxResults / 3), // Distribute results
      minScore,
    });
  }

  async function fetchAndSearchUnits(): Promise<SearchResult<Unit>[]> {
    if (!currentQuery.query) return [];

    const { data, error } = await supabase
      .from("units")
      .select("*")
      .or(
        `unit_name.ilike.%${currentQuery.query}%,unit_code.ilike.%${currentQuery.query}%,unit_type.ilike.%${currentQuery.query}%`
      );

    if (error) throw new Error(handleSupabaseError(error));

    const unitFields: SearchField[] = [
      { name: "unit_name", weight: 1.0, type: "text" },
      { name: "unit_code", weight: 0.9, type: "text" },
      { name: "unit_type", weight: 0.7, type: "text" },
    ];

    return processSearchResults(data || [], currentQuery.query, unitFields, {
      fuzzyMatch: currentQuery.fuzzyMatch,
      typoTolerance: currentQuery.typoTolerance,
      highlightResults: currentQuery.highlightResults,
      maxResults: Math.floor(maxResults / 3),
      minScore,
    });
  }

  return {
    ...searchQuery,
    results: searchQuery.data,
    search: debouncedSearch,
    instantSearch: performSearch,
  };
}

// ============================================
// BOOKING SEARCH HOOK
// ============================================

interface UseBookingSearchOptions {
  filters?: FilterBuilder[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  pageSize?: number;
  enabled?: boolean;
}

export function useBookingSearch(options: UseBookingSearchOptions = {}) {
  const {
    filters = [],
    sortBy = "created_at",
    sortOrder = "desc",
    pageSize = 20,
    enabled = true,
  } = options;

  const { currentQuery, activeFilters, dateRangeFilter, workflowFilter, financialFilter } =
    useSearchStore();

  const queryKey = useMemo(
    () => [
      "booking-search",
      currentQuery.query,
      Array.from(activeFilters.values()),
      dateRangeFilter,
      workflowFilter,
      financialFilter,
      filters.map((f) => f.build()),
      sortBy,
      sortOrder,
    ],
    [
      currentQuery.query,
      activeFilters,
      dateRangeFilter,
      workflowFilter,
      financialFilter,
      filters,
      sortBy,
      sortOrder,
    ]
  );

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("bookings")
        .select(
          `
          *,
          unit:units(*),
          guest:guests(*)
        `,
          { count: "exact" }
        )
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1)
        .order(sortBy, { ascending: sortOrder === "asc" });

      // Apply search query
      if (currentQuery.query) {
        query = query.or(
          `guest_name.ilike.%${currentQuery.query}%,booking_reference.ilike.%${currentQuery.query}%,email.ilike.%${currentQuery.query}%`
        );
      }

      // Apply active filters
      const allFilters = [...Array.from(activeFilters.values()), ...filters.map((f) => f.build())];
      query = buildSupabaseQuery(query, allFilters);

      const { data, error, count } = await query;
      if (error) throw new Error(handleSupabaseError(error));

      // Apply client-side filters
      let filtered = applyBookingFilters(
        data || [],
        allFilters,
        dateRangeFilter,
        workflowFilter,
        financialFilter
      );

      // Score and sort by relevance if searching
      if (currentQuery.query) {
        const scored = processSearchResults(filtered, currentQuery.query, currentQuery.fields, {
          fuzzyMatch: currentQuery.fuzzyMatch,
          typoTolerance: currentQuery.typoTolerance,
          highlightResults: currentQuery.highlightResults,
        });

        filtered = scored.map((r) => r.item);
      }

      return {
        bookings: filtered,
        totalCount: count || 0,
        page: pageParam,
        hasMore: (pageParam + 1) * pageSize < (count || 0),
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    enabled,
    staleTime: 30000,
  });
}

// ============================================
// GUEST SEARCH HOOK
// ============================================

export function useGuestSearch(searchTerm: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["guest-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from("guests")
        .select("*")
        .or(
          `guest_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`
        )
        .limit(10);

      if (error) throw new Error(handleSupabaseError(error));

      // Score results
      const fields: SearchField[] = [
        { name: "guest_name", weight: 1.0, type: "text" },
        { name: "email", weight: 0.8, type: "email" },
        { name: "phone_number", weight: 0.6, type: "text" },
      ];

      const scored = (data || [])
        .map((guest) => ({
          guest,
          score: fuzzySearchScore(searchTerm, guest, fields),
        }))
        .filter((item) => item.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.guest);

      return scored;
    },
    enabled: enabled && searchTerm.length >= 2,
    staleTime: 60000,
  });
}

// ============================================
// UNIT AVAILABILITY SEARCH
// ============================================

interface UseUnitAvailabilitySearchOptions {
  checkIn?: string;
  checkOut?: string;
  unitType?: string;
  minOccupancy?: number;
  maxRate?: number;
  enabled?: boolean;
}

export function useUnitAvailabilitySearch(options: UseUnitAvailabilitySearchOptions = {}) {
  const { checkIn, checkOut, unitType, minOccupancy, maxRate, enabled = true } = options;

  return useQuery({
    queryKey: ["unit-availability-search", checkIn, checkOut, unitType, minOccupancy, maxRate],
    queryFn: async () => {
      if (!checkIn || !checkOut) {
        // If no dates, just return all units matching criteria
        let query = supabase.from("units").select("*");

        if (unitType) query = query.eq("unit_type", unitType);
        if (minOccupancy) query = query.gte("max_occupancy", minOccupancy);
        if (maxRate) query = query.lte("base_rate", maxRate);

        const { data, error } = await query;
        if (error) throw new Error(handleSupabaseError(error));

        return data || [];
      }

      // Use optimized availability checking
      const { data, error } = await db.bookings.checkMultiUnitAvailability(checkIn, checkOut, {
        unitTypes: unitType ? [unitType] : undefined,
        minOccupancy,
        maxRate,
      });

      if (error) throw new Error(handleSupabaseError(error));

      let units = data || [];

      return units;
    },
    enabled,
    staleTime: 60000,
  });
}

// ============================================
// SEARCH SUGGESTIONS HOOK
// ============================================

export function useSearchSuggestions(partial: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { recentSearches, searchMetrics } = useSearchStore();

  return useQuery({
    queryKey: ["search-suggestions", partial],
    queryFn: async () => {
      if (!partial || partial.length < 2) return [];

      const suggestions: string[] = [];

      // Add recent searches that match
      recentSearches.forEach((search) => {
        if (search.toLowerCase().startsWith(partial.toLowerCase())) {
          suggestions.push(search);
        }
      });

      // Add popular searches
      const popularSearches = searchMetrics.popularSearches;
      popularSearches.forEach((count, search) => {
        if (
          search.toLowerCase().startsWith(partial.toLowerCase()) &&
          !suggestions.includes(search)
        ) {
          suggestions.push(search);
        }
      });

      // Fetch common terms from database
      const [bookingTerms, guestTerms] = await Promise.all([
        // Get common booking references
        supabase
          .from("bookings")
          .select("booking_reference")
          .ilike("booking_reference", `${partial}%`)
          .limit(5),
        // Get common guest names
        supabase.from("guests").select("guest_name").ilike("guest_name", `${partial}%`).limit(5),
      ]);

      if (bookingTerms.data) {
        bookingTerms.data.forEach((b) => {
          if (!suggestions.includes(b.booking_reference)) {
            suggestions.push(b.booking_reference);
          }
        });
      }

      if (guestTerms.data) {
        guestTerms.data.forEach((g) => {
          if (!suggestions.includes(g.guest_name)) {
            suggestions.push(g.guest_name);
          }
        });
      }

      return suggestions.slice(0, 10);
    },
    enabled: enabled && partial.length >= 2,
    staleTime: 30000,
  });
}

// ============================================
// SEARCH ANALYTICS HOOK
// ============================================

export function useSearchAnalytics(period: { from: Date; to: Date }) {
  const { searchMetrics, getPopularSearches } = useSearchStore();

  return useQuery({
    queryKey: ["search-analytics", period.from, period.to],
    queryFn: async () => {
      // Get top searches
      const topSearches = getPopularSearches(20);

      // Calculate search performance metrics
      const performanceMetrics = {
        totalSearches: searchMetrics.totalSearches,
        averageResponseTime: searchMetrics.averageResponseTime,
        cacheHitRate: searchMetrics.cacheHitRate,
        errorRate:
          searchMetrics.totalSearches > 0
            ? searchMetrics.searchErrors / searchMetrics.totalSearches
            : 0,
      };

      // Get search volume over time (would need to track this)
      const searchVolume = []; // Placeholder for time-series data

      return {
        topSearches,
        performance: performanceMetrics,
        volume: searchVolume,
        period,
      };
    },
    staleTime: 300000, // 5 minutes
  });
}

// ============================================
// SEARCH EXPORT HOOK
// ============================================

export function useSearchExport() {
  const { searchResults, currentQuery, activeFilters } = useSearchStore();

  const exportMutation = useMutation({
    mutationFn: async ({
      format,
      fields,
      includeMetadata,
    }: {
      format: "csv" | "json" | "excel";
      fields: string[];
      includeMetadata?: boolean;
    }) => {
      const { exportSearchResultsToCSV, exportSearchResultsToJSON } = await import(
        "@/utils/search-filter"
      );

      let content: string;
      let mimeType: string;
      let filename: string;

      switch (format) {
        case "csv":
          content = exportSearchResultsToCSV(searchResults, fields);
          mimeType = "text/csv";
          filename = `search-results-${Date.now()}.csv`;
          break;

        case "json":
          content = exportSearchResultsToJSON(searchResults, includeMetadata);
          mimeType = "application/json";
          filename = `search-results-${Date.now()}.json`;
          break;

        case "excel":
          // Would need a library like xlsx for Excel export
          throw new Error("Excel export not yet implemented");

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Create blob and trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      return { filename, size: blob.size };
    },
  });

  return exportMutation;
}

// ============================================
// SAVED SEARCH HOOK
// ============================================

export function useSavedSearches() {
  const { searchPresets, savePreset, loadPreset, deletePreset } = useSearchStore();
  const queryClient = useQueryClient();

  const saveSearchMutation = useMutation({
    mutationFn: async (params: { name: string; description?: string; makeDefault?: boolean }) => {
      const { currentQuery, activeFilters, sortBy, sortOrder } = useSearchStore.getState();

      const presetId = savePreset({
        name: params.name,
        description: params.description,
        query: currentQuery,
        filters: Array.from(activeFilters.values()),
        sortBy,
        sortOrder,
        isDefault: params.makeDefault,
      });

      return presetId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  const loadSearchMutation = useMutation({
    mutationFn: async (presetId: string) => {
      loadPreset(presetId);
      return presetId;
    },
    onSuccess: () => {
      // Trigger new search with loaded preset
      useSearchStore.getState().performSearch();
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (presetId: string) => {
      deletePreset(presetId);
      return presetId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  return {
    savedSearches: Array.from(searchPresets.values()),
    saveSearch: saveSearchMutation.mutate,
    loadSearch: loadSearchMutation.mutate,
    deleteSearch: deleteSearchMutation.mutate,
    isSaving: saveSearchMutation.isPending,
    isLoading: loadSearchMutation.isPending,
    isDeleting: deleteSearchMutation.isPending,
  };
}
