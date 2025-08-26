import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  X,
  Clock,
  Calendar,
  DollarSign,
  Building,
  FileText,
  Users,
  TrendingUp,
  ArrowRight,
  Command,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "booking" | "expense" | "property" | "guest" | "report";
  title: string;
  subtitle: string;
  url: string;
  metadata?: string;
}

interface SearchBarProps {
  className?: string;
  variant?: "full" | "compact" | "button";
  placeholder?: string;
}

// Mock search results - in a real app this would come from your API
const mockSearchResults: SearchResult[] = [
  {
    id: "1",
    type: "booking",
    title: "Ocean View Villa - Maria Santos",
    subtitle: "Dec 25-30, 2024 • ₱25,000",
    url: "/bookings/123",
    metadata: "Confirmed",
  },
  {
    id: "2",
    type: "expense",
    title: "Maintenance - Room AC Repair",
    subtitle: "Dec 15, 2024 • ₱5,500",
    url: "/expenses/456",
    metadata: "Room #205",
  },
  {
    id: "3",
    type: "property",
    title: "Beachfront Suite #101",
    subtitle: "Premium room with ocean view",
    url: "/properties/101",
    metadata: "Available",
  },
  {
    id: "4",
    type: "guest",
    title: "John Doe",
    subtitle: "john.doe@email.com • +63 917 123 4567",
    url: "/guests/789",
    metadata: "3 bookings",
  },
];

const recentSearches = [
  "Ocean View Villa",
  "December bookings",
  "GCash payments",
  "Room maintenance",
  "Maria Santos",
];

export function SearchBar({ className, variant = "full", placeholder }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  // Mock search function
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      const filtered = mockSearchResults.filter(
        (result) =>
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.subtitle.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setQuery(searchQuery);
    setIsOpen(false);

    // Navigate to search results page
    navigate({
      to: "/search",
      search: { q: searchQuery },
    });
  };

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    navigate({ to: result.url });
  };

  const getResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "booking":
        return Calendar;
      case "expense":
        return DollarSign;
      case "property":
        return Building;
      case "guest":
        return Users;
      case "report":
        return FileText;
      default:
        return Search;
    }
  };

  const getResultColor = (type: SearchResult["type"]) => {
    switch (type) {
      case "booking":
        return "text-ocean-600 bg-ocean-100 dark:text-ocean-400 dark:bg-ocean-900/20";
      case "expense":
        return "text-palm-600 bg-palm-100 dark:text-palm-400 dark:bg-palm-900/20";
      case "property":
        return "text-coral-600 bg-coral-100 dark:text-coral-400 dark:bg-coral-900/20";
      case "guest":
        return "text-sunset-600 bg-sunset-100 dark:text-sunset-400 dark:bg-sunset-900/20";
      case "report":
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  if (variant === "button") {
    return (
      <div className={className}>
        <button
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          className="bg-sand-50 hover:bg-sand-100 group flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm text-gray-600 shadow-sm transition-all duration-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          aria-label="Open search"
        >
          <Search className="group-hover:text-ocean-600 dark:group-hover:text-ocean-400 h-4 w-4 text-gray-500" />
          <span className="hidden sm:inline">{placeholder || "Search resorts, bookings..."}</span>
          <span className="sm:hidden">Search</span>
          <kbd className="border-sand-200 hidden items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium shadow-sm sm:flex dark:border-gray-500 dark:bg-gray-600">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {isOpen && <SearchModal />}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder || "Search..."}
            className="bg-sand-50 focus:ring-ocean-500 min-h-[44px] w-full rounded-xl py-2 pr-4 pl-9 text-sm transition-all duration-200 placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:outline-none dark:bg-gray-700 dark:text-white dark:focus:bg-gray-600"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isOpen && <SearchDropdown />}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch(query);
            }
          }}
          placeholder={placeholder || "Search bookings, expenses, properties..."}
          className="bg-sand-50 focus:ring-ocean-500 min-h-[56px] w-full rounded-2xl py-4 pr-20 pl-12 text-base transition-all duration-200 placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:outline-none dark:bg-gray-700 dark:text-white dark:focus:bg-gray-600"
        />
        <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-2">
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="border-sand-200 hidden items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium shadow-sm sm:flex dark:border-gray-500 dark:bg-gray-600">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      </div>

      {isOpen && <SearchDropdown />}
    </div>
  );

  function SearchDropdown() {
    return (
      <div
        ref={dropdownRef}
        className="border-sand-200 absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
      >
        {/* Quick suggestions */}
        {!query && (
          <div className="p-4">
            <h4 className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
              RECENT SEARCHES
            </h4>
            <div className="space-y-1">
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSearch(search)}
                  className="hover:bg-sand-50 group flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors dark:hover:bg-gray-700"
                >
                  <Clock className="group-hover:text-ocean-500 h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{search}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search results */}
        {query && (
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="border-ocean-500 h-6 w-6 animate-spin rounded-full border-b-2"></div>
              </div>
            ) : results.length > 0 ? (
              <>
                <h4 className="mb-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  SEARCH RESULTS
                </h4>
                <div className="space-y-1">
                  {results.map((result) => {
                    const Icon = getResultIcon(result.type);
                    const colorClass = getResultColor(result.type);

                    return (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="hover:bg-sand-50 group flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors dark:hover:bg-gray-700"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="group-hover:text-ocean-700 dark:group-hover:text-ocean-300 truncate text-sm font-medium text-gray-900 dark:text-white">
                            {result.title}
                          </p>
                          <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                            {result.subtitle}
                          </p>
                        </div>
                        {result.metadata && (
                          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-500">
                            {result.metadata}
                          </span>
                        )}
                        <ArrowRight className="group-hover:text-ocean-500 h-4 w-4 text-gray-400 opacity-0 transition-all group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-8">
                <Search className="mb-3 h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  No results found
                </p>
                <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-500">
                  Try searching for bookings, expenses, properties, or guest names
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="border-sand-200 border-t p-2 dark:border-gray-700">
          <div className="flex items-center justify-between px-2 text-xs text-gray-500 dark:text-gray-500">
            <span>Press Enter to search all</span>
            <div className="flex items-center gap-1">
              <span>⌘K to focus</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function SearchModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20 backdrop-blur-sm">
        <div className="border-sand-200 mx-4 w-full max-w-2xl rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95">
          <div className="border-sand-200 flex items-center border-b px-4 py-4 dark:border-gray-700">
            <Search className="text-ocean-500 h-5 w-5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch(query);
                }
              }}
              className="min-h-[44px] flex-1 bg-transparent px-3 text-base outline-none placeholder:text-gray-500 dark:text-white"
              placeholder="Search resorts, bookings, expenses..."
              autoFocus
            />
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-sand-100 min-h-[32px] rounded-md px-2 py-1 text-xs text-gray-500 transition-colors dark:hover:bg-gray-700"
              aria-label="Close search"
            >
              ESC
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <SearchDropdown />
          </div>
        </div>
      </div>
    );
  }
}
