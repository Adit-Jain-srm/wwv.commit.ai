"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type IntelligenceFilters = {
  industry: string | null;
  skill: string | null;
  neighborhood: string | null;
};

type SearchContextValue = {
  query: string;
  setQuery: (q: string) => void;
  activeSuggestion: string | null;
  setActiveSuggestion: (s: string | null) => void;
  filters: IntelligenceFilters;
  setFilters: (f: IntelligenceFilters) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [filters, setFilters] = useState<IntelligenceFilters>({
    industry: null,
    skill: null,
    neighborhood: null,
  });
  return (
    <SearchContext.Provider
      value={{
        query,
        setQuery,
        activeSuggestion,
        setActiveSuggestion,
        filters,
        setFilters,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  return (
    ctx ?? {
      query: "",
      setQuery: () => {},
      activeSuggestion: null,
      setActiveSuggestion: () => {},
      filters: { industry: null, skill: null, neighborhood: null },
      setFilters: () => {},
    }
  );
}
