import { FileText, Maximize2, Minimize2, ZoomIn, ZoomOut, ArrowLeft } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface PDFViewerProps {
    documentId: string;
    currentPage?: number;
    highlights?: any[];
    onClose?: () => void;
}

export function PDFViewer({ documentId, currentPage = 1, highlights = [], onClose }: PDFViewerProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [zoom, setZoom] = useState(100);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const getSearchString = (text: string) => {
        if (!text) return '';
        // Take the first 5-6 words to ensure a match without line-break issues breaking the native search
        const words = text.replace(/[\r\n]+/g, ' ').split(/\s+/).filter(Boolean);
        return encodeURIComponent(words.slice(0, 6).join(' '));
    };

    const pdfBaseUrl = `/api/pdf/${documentId}`;
    const iframeKey = `${documentId}-page-${currentPage}-zoom-${zoom}`;
    const searchParam = highlights && highlights.length > 0 ? `&search=${getSearchString(highlights[0])}` : '';
    const pdfUrl = `${pdfBaseUrl}#page=${currentPage}&zoom=${zoom}&toolbar=0&navpanes=0&scrollbar=0${searchParam}`;

    useEffect(() => {
        setHasError(false);
    }, [documentId]);

    return (
        <div className={`h-full flex flex-col bg-slate-100 border-r border-slate-200 transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-50' : 'relative'}`}>
            {/* Viewer Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 border border-slate-200 mr-1"
                            title="Close PDF"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <FileText className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                            Source Document
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-medium">Page {currentPage}</span>
                            {highlights.length > 0 && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                    {highlights.length} Highlights
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                    <button
                        onClick={() => setZoom(z => Math.max(50, z - 10))}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all" title="Zoom Out">
                        <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 min-w-[32px] text-center">{zoom}%</span>
                    <button
                        onClick={() => setZoom(z => Math.min(200, z + 10))}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all" title="Zoom In">
                        <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-white hover:shadow-sm rounded transition-all"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-slate-600" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
                    </button>
                </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-hidden relative min-h-0 bg-slate-200/50 backdrop-blur-sm">
                {hasError ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 p-12 text-center">
                        <div className="p-6 bg-white rounded-full shadow-inner">
                            <FileText className="w-12 h-12 opacity-20" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-600">PDF view is currently restricted</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[240px]">This is likely due to iframe security policies in some browsers or the backend being offline.</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full relative">
                        <iframe
                            key={iframeKey}
                            ref={iframeRef}
                            src={pdfUrl}
                            className="w-full h-full border-none shadow-2xl"
                            title="PDF Document"
                            onError={() => setHasError(true)}
                        />

                        {/* 
                Lead Architect Note: 
                Real highlight overlays require rendering the PDF via canvas (react-pdf). 
                With iframe, we can only provide the jump-to functionality via URL hashes.
            */}
                    </div>
                )}
            </div>
        </div>
    );
}
