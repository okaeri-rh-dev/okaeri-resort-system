/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
/**
 * Advanced Search Store with Debouncing, Caching, and Real-time Capabilities - PHASE 3-4
 *
 * Features:
 * - Real-time search with configurable debouncing
 * Note: Advanced features deferred to Phase 3-4
 * - Multi-field search across bookings, guests, and units
 * - Search result caching with intelligent invalidation
 * - Search history and preset management
 * - Performance tracking and analytics
 * - Integration with workflow states
 */

import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import type { BookingStatus, PaymentStatus, BookingFilters, Booking, Unit, Guest } from "@/types";

// Enable MapSet plugin for Immer to handle Map and Set objects
enableMapSet();

// ============================================
// TYPES
// ============================================

export interface SearchQuery {
  query: string;
  fields: SearchField[];
  fuzzyMatch: boolean;
  typoTolerance: number; // 0-1, higher = more tolerant
  highlightResults: boolean;
}

export interface SearchField {
  name: string;
  weight: number; // Importance of field in search scoring
  type: "text" | "email" | "reference" | "numeric" | "date";
}

export interface AdvancedFilter {
  id: string;
  name: string;
  type: "date_range" | "status" | "amount_range" | "workflow" | "guest" | "unit" | "custom";
  operator: "equals" | "contains" | "between" | "in" | "not_in" | "greater_than" | "less_than";
  value: any;
  isActive: boolean;
}

export interface SearchPreset {
  id: string;
  name: string;
  description?: string;
  query?: SearchQuery;
  filters: AdvancedFilter[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isDefault?: boolean;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
}

export interface SearchResult<T = any> {
  item: T;
  score: number; // Relevance score
  highlights?: Record<string, string[]>; // Field name -> highlighted snippets
  matchedFields: string[];
  type: "booking" | "guest" | "unit";
}

export interface SearchCache {
  query: string;
  filters: string; // Serialized filters
  results: SearchResult[];
  timestamp: number;
  ttl: number; // Time to live in ms
}

export interface SearchMetrics {
  totalSearches: number;
  averageResponseTime: number;
  cacheHitRate: number;
  popularSearches: Map<string, number>;
  searchErrors: number;
  lastSearchDuration?: number;
}

export interface WorkflowFilter {
  hasWorkflowState: boolean;
  workflowStatus?: "active" | "completed" | "failed" | "pending";
  hasPendingActions: boolean;
  overdueActions: boolean;
  automatedTriggers?: string[];
}

export interface SearchState {
  // Core search state
  currentQuery: SearchQuery;
  activeFilters: Map<string, AdvancedFilter>;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchError?: string;

  // Advanced filters
  dateRangeFilter?: {
    field: "check_in" | "check_out" | "created_at" | "updated_at";
    from: Date | null;
    to: Date | null;
    includeTime: boolean;
  };
  workflowFilter?: WorkflowFilter;
  financialFilter?: {
    minAmount?: number;
    maxAmount?: number;
    paymentStatus?: PaymentStatus[];
    paymentMethods?: string[];
    hasOverdue: boolean;
  };
  guestFilter?: {
    isRepeatGuest: boolean;
    isVIP: boolean;
    minBookings?: number;
    minSpent?: number;
    contactPreference?: "email" | "phone" | "both";
  };
  unitFilter?: {
    types?: string[];
    minOccupancy?: number;
    maxRate?: number;
    availableOnly: boolean;
  };

  // Search configuration
  searchConfig: {
    debounceMs: number;
    fuzzyThreshold: number;
    maxResults: number;
    searchFields: SearchField[];
    enableCache: boolean;
    cacheSize: number;
    cacheTTL: number;
  };

  // Presets and history
  searchPresets: Map<string, SearchPreset>;
  searchHistory: SearchQuery[];
  recentSearches: string[];
  savedSearches: Map<string, SearchQuery>;

  // Cache management
  searchCache: Map<string, SearchCache>;
  cacheStats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  // Performance metrics
  searchMetrics: SearchMetrics;

  // Pagination
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };

  // Sorting
  sortBy: string;
  sortOrder: "asc" | "desc";

  // UI state
  showAdvancedFilters: boolean;
  selectedResultId?: string;
  resultViewMode: "list" | "grid" | "table";
}

export interface SearchActions {
  // Core search actions
  setSearchQuery: (query: Partial<SearchQuery>) => void;
  performSearch: (query?: string) => Promise<void>;
  clearSearch: () => void;

  // Filter actions
  addFilter: (filter: AdvancedFilter) => void;
  updateFilter: (id: string, updates: Partial<AdvancedFilter>) => void;
  removeFilter: (id: string) => void;
  toggleFilter: (id: string) => void;
  clearFilters: () => void;

  // Advanced filter actions
  setDateRangeFilter: (filter: SearchState["dateRangeFilter"]) => void;
  setWorkflowFilter: (filter: Partial<WorkflowFilter>) => void;
  setFinancialFilter: (filter: SearchState["financialFilter"]) => void;
  setGuestFilter: (filter: SearchState["guestFilter"]) => void;
  setUnitFilter: (filter: SearchState["unitFilter"]) => void;

  // Preset management
  savePreset: (preset: Omit<SearchPreset, "id" | "createdAt" | "usageCount">) => string;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  updatePresetUsage: (presetId: string) => void;
  setDefaultPreset: (presetId: string) => void;

  // Search configuration
  updateSearchConfig: (config: Partial<SearchState["searchConfig"]>) => void;
  addSearchField: (field: SearchField) => void;
  removeSearchField: (fieldName: string) => void;

  // History management
  addToHistory: (query: SearchQuery) => void;
  clearHistory: () => void;
  addToRecentSearches: (search: string) => void;
  saveSearch: (name: string, query: SearchQuery) => void;

  // Cache management
  getCachedResults: (query: string, filters: string) => SearchResult[] | null;
  setCachedResults: (query: string, filters: string, results: SearchResult[]) => void;
  clearCache: () => void;
  pruneCache: () => void;

  // Pagination
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  previousPage: () => void;

  // Sorting
  setSortBy: (field: string) => void;
  toggleSortOrder: () => void;

  // UI actions
  toggleAdvancedFilters: () => void;
  selectResult: (id: string) => void;
  setResultViewMode: (mode: "list" | "grid" | "table") => void;

  // Performance tracking
  trackSearchMetrics: (duration: number, resultCount: number) => void;
  recordSearchError: () => void;
  getPopularSearches: (limit?: number) => Array<[string, number]>;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

const DEFAULT_SEARCH_CONFIG: SearchState["searchConfig"] = {
  debounceMs: 300,
  fuzzyThreshold: 0.6,
  maxResults: 100,
  searchFields: [
    { name: "guest_name", weight: 1.0, type: "text" },
    { name: "email", weight: 0.9, type: "email" },
    { name: "booking_reference", weight: 1.0, type: "reference" },
    { name: "contact_number", weight: 0.8, type: "text" },
    { name: "internal_notes", weight: 0.6, type: "text" },
    { name: "special_requests", weight: 0.5, type: "text" },
    { name: "unit_name", weight: 0.7, type: "text" },
  ],
  enableCache: true,
  cacheSize: 50,
  cacheTTL: 300000, // 5 minutes
};

export const useSearchStore = create<SearchState & SearchActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          currentQuery: {
            query: "",
            fields: DEFAULT_SEARCH_CONFIG.searchFields,
            fuzzyMatch: true,
            typoTolerance: 0.3,
            highlightResults: true,
          },
          activeFilters: new Map(),
          searchResults: [],
          isSearching: false,
          searchError: undefined,

          dateRangeFilter: undefined,
          workflowFilter: undefined,
          financialFilter: undefined,
          guestFilter: undefined,
          unitFilter: undefined,

          searchConfig: DEFAULT_SEARCH_CONFIG,
          searchPresets: new Map(),
          searchHistory: [],
          recentSearches: [],
          savedSearches: new Map(),

          searchCache: new Map(),
          cacheStats: {
            hits: 0,
            misses: 0,
            evictions: 0,
          },

          searchMetrics: {
            totalSearches: 0,
            averageResponseTime: 0,
            cacheHitRate: 0,
            popularSearches: new Map(),
            searchErrors: 0,
          },

          pagination: {
            page: 0,
            pageSize: 20,
            total: 0,
            hasMore: false,
          },

          sortBy: "relevance",
          sortOrder: "desc",

          showAdvancedFilters: false,
          selectedResultId: undefined,
          resultViewMode: "list",

          // Core search actions
          setSearchQuery: (query) =>
            set((state) => {
              state.currentQuery = { ...state.currentQuery, ...query };
            }),

          performSearch: async (query) => {
            const state = get();
            const searchQuery = query || state.currentQuery.query;

            if (!searchQuery && state.activeFilters.size === 0) {
              set((state) => {
                state.searchResults = [];
                state.isSearching = false;
              });
              return;
            }

            // Check cache first
            const filterKey = JSON.stringify(Array.from(state.activeFilters.values()));
            const cached = state.getCachedResults(searchQuery, filterKey);
            if (cached && state.searchConfig.enableCache) {
              set((state) => {
                state.searchResults = cached;
                state.cacheStats.hits++;
                state.isSearching = false;
              });
              return;
            }

            set((state) => {
              state.isSearching = true;
              state.searchError = undefined;
              state.cacheStats.misses++;
            });

            try {
              const startTime = Date.now();

              // Simulate search - replace with actual API call
              await new Promise((resolve) => setTimeout(resolve, 100));

              const results: SearchResult[] = []; // Implement actual search logic

              const duration = Date.now() - startTime;

              set((state) => {
                state.searchResults = results;
                state.isSearching = false;
                state.pagination.total = results.length;
                state.pagination.hasMore = results.length > state.pagination.pageSize;
              });

              // Cache results
              if (state.searchConfig.enableCache) {
                state.setCachedResults(searchQuery, filterKey, results);
              }

              // Track metrics
              state.trackSearchMetrics(duration, results.length);

              // Add to history
              if (searchQuery) {
                state.addToRecentSearches(searchQuery);
              }
            } catch (error) {
              set((state) => {
                state.isSearching = false;
                state.searchError = error instanceof Error ? error.message : "Search failed";
              });
              state.recordSearchError();
            }
          },

          clearSearch: () =>
            set((state) => {
              state.currentQuery.query = "";
              state.searchResults = [];
              state.selectedResultId = undefined;
            }),

          // Filter actions
          addFilter: (filter) =>
            set((state) => {
              state.activeFilters.set(filter.id, filter);
            }),

          updateFilter: (id, updates) =>
            set((state) => {
              const filter = state.activeFilters.get(id);
              if (filter) {
                state.activeFilters.set(id, { ...filter, ...updates });
              }
            }),

          removeFilter: (id) =>
            set((state) => {
              state.activeFilters.delete(id);
            }),

          toggleFilter: (id) =>
            set((state) => {
              const filter = state.activeFilters.get(id);
              if (filter) {
                filter.isActive = !filter.isActive;
              }
            }),

          clearFilters: () =>
            set((state) => {
              state.activeFilters.clear();
              state.dateRangeFilter = undefined;
              state.workflowFilter = undefined;
              state.financialFilter = undefined;
              state.guestFilter = undefined;
              state.unitFilter = undefined;
            }),

          // Advanced filter actions
          setDateRangeFilter: (filter) =>
            set((state) => {
              state.dateRangeFilter = filter;
            }),

          setWorkflowFilter: (filter) =>
            set((state) => {
              state.workflowFilter = state.workflowFilter
                ? { ...state.workflowFilter, ...filter }
                : (filter as WorkflowFilter);
            }),

          setFinancialFilter: (filter) =>
            set((state) => {
              state.financialFilter = filter;
            }),

          setGuestFilter: (filter) =>
            set((state) => {
              state.guestFilter = filter;
            }),

          setUnitFilter: (filter) =>
            set((state) => {
              state.unitFilter = filter;
            }),

          // Preset management
          savePreset: (preset) => {
            const id = `preset-${Date.now()}`;
            const newPreset: SearchPreset = {
              ...preset,
              id,
              createdAt: new Date().toISOString(),
              usageCount: 0,
            };

            set((state) => {
              state.searchPresets.set(id, newPreset);
            });

            return id;
          },

          loadPreset: (presetId) => {
            const preset = get().searchPresets.get(presetId);
            if (!preset) return;

            set((state) => {
              if (preset.query) {
                state.currentQuery = preset.query;
              }

              state.activeFilters.clear();
              preset.filters.forEach((filter) => {
                state.activeFilters.set(filter.id, filter);
              });

              if (preset.sortBy) {
                state.sortBy = preset.sortBy;
              }

              if (preset.sortOrder) {
                state.sortOrder = preset.sortOrder;
              }

              // Update preset usage
              preset.usageCount++;
              preset.lastUsed = new Date().toISOString();
            });
          },

          deletePreset: (presetId) =>
            set((state) => {
              state.searchPresets.delete(presetId);
            }),

          updatePresetUsage: (presetId) =>
            set((state) => {
              const preset = state.searchPresets.get(presetId);
              if (preset) {
                preset.usageCount++;
                preset.lastUsed = new Date().toISOString();
              }
            }),

          setDefaultPreset: (presetId) =>
            set((state) => {
              state.searchPresets.forEach((preset) => {
                preset.isDefault = preset.id === presetId;
              });
            }),

          // Search configuration
          updateSearchConfig: (config) =>
            set((state) => {
              state.searchConfig = { ...state.searchConfig, ...config };
            }),

          addSearchField: (field) =>
            set((state) => {
              const exists = state.searchConfig.searchFields.find((f) => f.name === field.name);
              if (!exists) {
                state.searchConfig.searchFields.push(field);
              }
            }),

          removeSearchField: (fieldName) =>
            set((state) => {
              state.searchConfig.searchFields = state.searchConfig.searchFields.filter(
                (f) => f.name !== fieldName
              );
            }),

          // History management
          addToHistory: (query) =>
            set((state) => {
              state.searchHistory.unshift(query);
              if (state.searchHistory.length > 50) {
                state.searchHistory = state.searchHistory.slice(0, 50);
              }
            }),

          clearHistory: () =>
            set((state) => {
              state.searchHistory = [];
              state.recentSearches = [];
            }),

          addToRecentSearches: (search) =>
            set((state) => {
              if (!state.recentSearches.includes(search)) {
                state.recentSearches.unshift(search);
                if (state.recentSearches.length > 10) {
                  state.recentSearches = state.recentSearches.slice(0, 10);
                }
              }

              // Update popular searches
              const count = state.searchMetrics.popularSearches.get(search) || 0;
              state.searchMetrics.popularSearches.set(search, count + 1);
            }),

          saveSearch: (name, query) =>
            set((state) => {
              state.savedSearches.set(name, query);
            }),

          // Cache management
          getCachedResults: (query, filters) => {
            const state = get();
            const cacheKey = `${query}:${filters}`;
            const cached = state.searchCache.get(cacheKey);

            if (cached) {
              const now = Date.now();
              if (now - cached.timestamp <= cached.ttl) {
                return cached.results;
              } else {
                // Expired, remove from cache
                state.searchCache.delete(cacheKey);
                set((state) => {
                  state.cacheStats.evictions++;
                });
              }
            }

            return null;
          },

          setCachedResults: (query, filters, results) => {
            const state = get();
            const cacheKey = `${query}:${filters}`;
            const cache: SearchCache = {
              query,
              filters,
              results,
              timestamp: Date.now(),
              ttl: state.searchConfig.cacheTTL,
            };

            set((draft) => {
              // Manage cache size
              if (draft.searchCache.size >= draft.searchConfig.cacheSize) {
                // Remove oldest entry
                const oldestKey = Array.from(draft.searchCache.entries()).sort(
                  (a, b) => a[1].timestamp - b[1].timestamp
                )[0]?.[0];
                if (oldestKey) {
                  draft.searchCache.delete(oldestKey);
                  draft.cacheStats.evictions++;
                }
              }

              draft.searchCache.set(cacheKey, cache);
            });
          },

          clearCache: () =>
            set((state) => {
              state.searchCache.clear();
              state.cacheStats = { hits: 0, misses: 0, evictions: 0 };
            }),

          pruneCache: () => {
            const now = Date.now();
            set((state) => {
              const keysToDelete: string[] = [];
              state.searchCache.forEach((cache, key) => {
                if (now - cache.timestamp > cache.ttl) {
                  keysToDelete.push(key);
                }
              });

              keysToDelete.forEach((key) => {
                state.searchCache.delete(key);
                state.cacheStats.evictions++;
              });
            });
          },

          // Pagination
          setPage: (page) =>
            set((state) => {
              state.pagination.page = page;
            }),

          setPageSize: (pageSize) =>
            set((state) => {
              state.pagination.pageSize = pageSize;
              state.pagination.page = 0; // Reset to first page
            }),

          nextPage: () =>
            set((state) => {
              if (state.pagination.hasMore) {
                state.pagination.page++;
              }
            }),

          previousPage: () =>
            set((state) => {
              if (state.pagination.page > 0) {
                state.pagination.page--;
              }
            }),

          // Sorting
          setSortBy: (field) =>
            set((state) => {
              state.sortBy = field;
            }),

          toggleSortOrder: () =>
            set((state) => {
              state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
            }),

          // UI actions
          toggleAdvancedFilters: () =>
            set((state) => {
              state.showAdvancedFilters = !state.showAdvancedFilters;
            }),

          selectResult: (id) =>
            set((state) => {
              state.selectedResultId = id;
            }),

          setResultViewMode: (mode) =>
            set((state) => {
              state.resultViewMode = mode;
            }),

          // Performance tracking
          trackSearchMetrics: (duration, resultCount) =>
            set((state) => {
              const metrics = state.searchMetrics;
              metrics.totalSearches++;
              metrics.lastSearchDuration = duration;

              // Update average response time
              metrics.averageResponseTime =
                (metrics.averageResponseTime * (metrics.totalSearches - 1) + duration) /
                metrics.totalSearches;

              // Update cache hit rate
              const { hits, misses } = state.cacheStats;
              const totalCacheAttempts = hits + misses;
              metrics.cacheHitRate = totalCacheAttempts > 0 ? hits / totalCacheAttempts : 0;
            }),

          recordSearchError: () =>
            set((state) => {
              state.searchMetrics.searchErrors++;
            }),

          getPopularSearches: (limit = 10) => {
            const { popularSearches } = get().searchMetrics;
            return Array.from(popularSearches.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, limit);
          },
        }))
      ),
      {
        name: "search-storage",
        storage: {
          getItem: (name) => {
            const value = localStorage.getItem(name);
            if (!value) return null;

            // Custom deserialization for Maps
            const parsed = JSON.parse(value);
            if (parsed.state) {
              if (parsed.state.activeFilters) {
                parsed.state.activeFilters = new Map(parsed.state.activeFilters);
              }
              if (parsed.state.searchPresets) {
                parsed.state.searchPresets = new Map(parsed.state.searchPresets);
              }
              if (parsed.state.savedSearches) {
                parsed.state.savedSearches = new Map(parsed.state.savedSearches);
              }
              if (parsed.state.searchCache) {
                parsed.state.searchCache = new Map(parsed.state.searchCache);
              }
              if (parsed.state.searchMetrics?.popularSearches) {
                parsed.state.searchMetrics.popularSearches = new Map(
                  parsed.state.searchMetrics.popularSearches
                );
              }
            }
            return parsed;
          },
          setItem: (name, value) => {
            // Custom serialization for Maps
            const toStore = { ...value };
            if (toStore.state) {
              if (toStore.state.activeFilters instanceof Map) {
                toStore.state.activeFilters = Array.from(toStore.state.activeFilters.entries());
              }
              if (toStore.state.searchPresets instanceof Map) {
                toStore.state.searchPresets = Array.from(toStore.state.searchPresets.entries());
              }
              if (toStore.state.savedSearches instanceof Map) {
                toStore.state.savedSearches = Array.from(toStore.state.savedSearches.entries());
              }
              if (toStore.state.searchCache instanceof Map) {
                toStore.state.searchCache = Array.from(toStore.state.searchCache.entries());
              }
              if (toStore.state.searchMetrics?.popularSearches instanceof Map) {
                toStore.state.searchMetrics.popularSearches = Array.from(
                  toStore.state.searchMetrics.popularSearches.entries()
                );
              }
            }
            localStorage.setItem(name, JSON.stringify(toStore));
          },
          removeItem: (name) => {
            localStorage.removeItem(name);
          },
        },
        partialize: (state) => ({
          searchPresets: state.searchPresets,
          searchHistory: state.searchHistory.slice(0, 20),
          recentSearches: state.recentSearches,
          savedSearches: state.savedSearches,
          searchConfig: state.searchConfig,
          searchMetrics: state.searchMetrics,
        }),
      }
    ),
    {
      name: "SearchStore",
    }
  )
);

// ============================================
// SUBSCRIPTIONS & SIDE EFFECTS
// ============================================

// Auto-prune cache periodically
if (typeof window !== "undefined") {
  setInterval(() => {
    useSearchStore.getState().pruneCache();
  }, 60000); // Every minute
}

// Subscribe to search query changes for debounced search
let searchDebounceTimer: NodeJS.Timeout | null = null;

useSearchStore.subscribe(
  (state) => state.currentQuery.query,
  (query) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const debounceMs = useSearchStore.getState().searchConfig.debounceMs;
    searchDebounceTimer = setTimeout(() => {
      if (query) {
        useSearchStore.getState().performSearch(query);
      }
    }, debounceMs);
  }
);

// Export store selectors for performance optimization
export const searchSelectors = {
  getCurrentQuery: (state: SearchState) => state.currentQuery,
  getActiveFilters: (state: SearchState) => state.activeFilters,
  getSearchResults: (state: SearchState) => state.searchResults,
  getSearchMetrics: (state: SearchState) => state.searchMetrics,
  getPaginatedResults: (state: SearchState) => {
    const { page, pageSize } = state.pagination;
    const start = page * pageSize;
    const end = start + pageSize;
    return state.searchResults.slice(start, end);
  },
  getFilteredResultsCount: (state: SearchState) => state.searchResults.length,
  getCacheStats: (state: SearchState) => ({
    ...state.cacheStats,
    hitRate: state.searchMetrics.cacheHitRate,
  }),
};
