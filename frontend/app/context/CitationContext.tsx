import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CitationContextType {
  highlightedSourceId: string | null;
  setHighlightedSourceId: (id: string | null) => void;
}

const CitationContext = createContext<CitationContextType>({
  highlightedSourceId: null,
  setHighlightedSourceId: () => {},
});

export function CitationProvider({ children }: { children: ReactNode }) {
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  return (
    <CitationContext.Provider value={{ highlightedSourceId, setHighlightedSourceId }}>
      {children}
    </CitationContext.Provider>
  );
}

export const useCitation = () => useContext(CitationContext);
