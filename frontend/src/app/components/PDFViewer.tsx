import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

export interface HighlightRect {
    page: number;
    rects: number[][];    // [[x0, y0, x1, y1], ...] in PDF points
    page_width: number;   // PDF page width in points (for scaling)
    page_height: number;  // PDF page height in points (for scaling)
}

interface PDFViewerProps {
    documentId: string;
    highlights: HighlightRect[];
}

export function PDFViewer({ documentId, highlights }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const [error, setError] = useState<string | null>(null);
    const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

    const pdfUrl = `/api/pdf/${documentId}`;

    // Scroll to first highlighted page whenever highlights change
    useEffect(() => {
        if (highlights.length > 0) {
            const firstPage = highlights[0].page;
            setCurrentPage(firstPage);
            setTimeout(() => {
                pageRefs.current[firstPage]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [highlights]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setError(null);
    }

    function onDocumentLoadError() {
        setError('Failed to load PDF. Make sure the document has been uploaded.');
    }

    // Get all highlight entries for a given page
    const pageHighlights = (pageNumber: number) =>
        highlights.filter(h => h.page === pageNumber);

    const hasHighlight = (pageNumber: number) => pageHighlights(pageNumber).length > 0;

    const highlightedPageCount = new Set(highlights.map(h => h.page)).size;

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">
                        Page {currentPage} / {numPages || '—'}
                    </span>
                    {highlightedPageCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                            {highlightedPageCount} source page{highlightedPageCount > 1 ? 's' : ''} highlighted
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        title="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        title="Next page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <button
                        onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Zoom in"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Zoom out"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* PDF Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {error ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                        <p>{error}</p>
                    </div>
                ) : (
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                                Loading PDF...
                            </div>
                        }
                    >
                        {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNumber => {
                            const pageHLs = pageHighlights(pageNumber);
                            return (
                                <div
                                    key={pageNumber}
                                    ref={el => { pageRefs.current[pageNumber] = el; }}
                                    className={`relative mx-auto w-fit rounded-xl overflow-hidden shadow-md transition-all duration-300 ${hasHighlight(pageNumber)
                                        ? 'ring-4 ring-amber-400 shadow-amber-200 shadow-lg'
                                        : 'ring-1 ring-gray-200'
                                        }`}
                                >
                                    <Page
                                        pageNumber={pageNumber}
                                        scale={scale}
                                        renderTextLayer
                                        renderAnnotationLayer
                                    />

                                    {/* Exact section highlight overlays — positioned using PDF point coordinates scaled by current zoom */}
                                    {pageHLs.flatMap((hl, hi) =>
                                        hl.rects.map((rect, ri) => {
                                            const scaleX = scale * (72 / 72); // PDF points → CSS px at scale
                                            const scaleY = scale;
                                            return (
                                                <div
                                                    key={`${hi}-${ri}`}
                                                    className="absolute bg-amber-300/40 pointer-events-none z-10"
                                                    style={{
                                                        left: rect[0] * scaleX,
                                                        top: rect[1] * scaleY - 2,          // 2px above text baseline
                                                        width: (rect[2] - rect[0]) * scaleX,
                                                        height: (rect[3] - rect[1]) * scaleY + 4, // 4px extra height total
                                                    }}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                            );
                        })}
                    </Document>
                )}
            </div>
        </div>
    );
}
