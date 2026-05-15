import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Brain, Loader2, AlertCircle } from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import apiClient from "../api/client";

const CustomNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-xl border-2 bg-[#1F2937] border-[#374151] transition-colors">
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-[#3B82F6] border-none"
      />
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[#F3F4F6]">
          {data.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-[#3B82F6] border-none"
      />
    </div>
  );
};

interface MindmapViewProps {
  notebookId: string;
  documentId?: string;
  isProcessingPDF?: boolean;
}

type TaskStatus = "ready" | "processing" | "completed" | "error";

export function MindmapView({
  notebookId,
  documentId,
  isProcessingPDF,
}: MindmapViewProps) {
  const [status, setStatus] = useState<TaskStatus>("ready");
  const [progress, setProgress] = useState(0);
  const [focusTopic, setFocusTopic] = useState("General Overview");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const progIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const stopProgress = () => {
    if (progIntervalRef.current !== null) {
      clearInterval(progIntervalRef.current);
      progIntervalRef.current = null;
    }
  };

  const loadMindmapData = (mindmapData: any) => {
    const totalNodes = mindmapData.nodes?.length || 1;
    const cols = Math.ceil(Math.sqrt(totalNodes));
    setNodes(
      mindmapData.nodes.map((n: any, idx: number) => ({
        id: n.id,
        position: n.position || {
          x: (idx % cols) * 250 + 50,
          y: Math.floor(idx / cols) * 150 + 50,
        },
        data: { label: n.label },
        type: "custom",
      }))
    );
    setEdges(
      mindmapData.edges.map((e: any, idx: number) => ({
        id: `e${idx}`,
        source: e.source,
        target: e.target,
        label: e.label,
      }))
    );
  };

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const { data } = await apiClient.get(`/api/notebooks/${notebookId}`);
        if (data.notebook?.mindmap_generated) {
          const mmRes = await apiClient.get(
            `/api/notebooks/${notebookId}/mindmap`
          );
          loadMindmapData(mmRes.data);
          setStatus("completed");
          setProgress(100);
        }
      } catch (err) {
        console.error("Failed to check existing mindmap", err);
      }
    };
    checkExisting();
  }, [notebookId]);

  const handleGenerate = async (topic = focusTopic) => {
    if (isProcessingPDF) {
      setAlertMessage(
        "Please wait until the PDF has finished processing its text."
      );
      return;
    }

    setStatus("processing");
    setProgress(0);
    stopProgress();

    let prog = 0;
    progIntervalRef.current = setInterval(() => {
      prog = Math.min(prog + 2, 95); // Slower progress to account for larger generation
      setProgress(prog);
    }, 600);

    try {
      const payload: any = {
        notebook_id: notebookId,
        focus_topic: topic,
        max_levels: 3,
      };
      if (documentId) payload.document_id = documentId;

      const { data } = await apiClient.post(
        `/api/notebooks/${notebookId}/mindmap`,
        payload
      );

      if (data.task_id) {
        pollTaskStatus(data.task_id);
      } else {
        stopProgress();
        setProgress(100);
        setStatus("error");
      }
    } catch (err) {
      stopProgress();
      setStatus("error");
      console.error("Mindmap generation failed:", err);
    }
  };

  const pollTaskStatus = (taskId: string) => {
    const check = async () => {
      try {
        const { data } = await apiClient.get(`/api/tasks/${taskId}`);
        const taskStatus = data.task_status;

        if (taskStatus === "SUCCESS") {
          stopProgress();
          setProgress(100);
          setStatus("completed");

          if (data.task_result?.mindmap) {
            try {
              const mindmapData =
                typeof data.task_result.mindmap === "string"
                  ? JSON.parse(data.task_result.mindmap)
                  : data.task_result.mindmap;

              loadMindmapData(mindmapData);
            } catch (e) {
              console.error("Failed to parse mindmap JSON", e);
              setStatus("error");
            }
          }
        } else if (taskStatus === "FAILURE") {
          stopProgress();
          setStatus("error");
        } else {
          setTimeout(check, 2000);
        }
      } catch {
        stopProgress();
        setStatus("error");
      }
    };
    setTimeout(check, 2000);
  };

  const reset = () => {
    stopProgress();
    setStatus("ready");
    setProgress(0);
    setNodes([]);
    setEdges([]);
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  if (status === "completed" && nodes.length > 0) {
    return (
      <div className="w-full h-full flex flex-col animate-in fade-in zoom-in-95 duration-300">
        <div className="flex-1 bg-[#111827] rounded-xl border border-[#374151] overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#374151" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 text-sm text-[#9CA3AF] hover:text-[#F3F4F6] bg-[#374151] hover:bg-[#4B5563] rounded-lg transition-colors font-medium w-full"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-8 mt-6">
        <div
          className={`mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-transform shadow-lg ${
            status === "error"
              ? "bg-[#EF4444]/20 shadow-[#EF4444]/10"
              : "bg-[#272E3E] shadow-black/20 border border-[#374151]"
          }`}
        >
          {status === "error" ? (
            <AlertCircle className="h-10 w-10 text-[#EF4444]" />
          ) : status === "processing" ? (
            <Loader2 className="h-10 w-10 text-[#3B82F6] animate-spin" />
          ) : (
            <Brain className="h-10 w-10 text-[#3B82F6]" />
          )}
        </div>
        <h3 className="font-bold text-[#F3F4F6] text-xl mb-3">Mind Map</h3>
        <p className="text-sm text-[#9CA3AF] max-w-[200px] mx-auto leading-relaxed">
          Visualize research connections & concepts
        </p>
      </div>

      <div className="mt-auto pt-4 space-y-4">
        {status === "ready" && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5 uppercase tracking-wide">
                Focus Topic
              </label>
              <input
                type="text"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                placeholder="e.g., General Overview"
                className="w-full bg-[#111827] border border-[#374151] focus:border-[#3B82F6] text-[#F3F4F6] placeholder:text-[#6B7280] rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={() => handleGenerate(focusTopic)}
              disabled={isProcessingPDF || !focusTopic.trim()}
              className="w-full py-3.5 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-[#3B82F6]/20 active:scale-[0.98]"
            >
              Generate Mind Map
            </button>
          </>
        )}
        {status === "processing" && (
          <div className="w-full bg-[#272E3E] p-5 rounded-xl border border-[#374151] shadow-inner">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-[#9CA3AF] font-medium">Processing...</span>
              <span className="text-[#3B82F6] font-bold">{progress}%</span>
            </div>
            <div className="h-2.5 bg-[#1F2937] rounded-full overflow-hidden border border-[#374151]">
              <div
                className="h-full bg-[#3B82F6] rounded-full transition-all duration-500 relative overflow-hidden"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="w-full bg-[#EF4444]/10 border border-[#EF4444]/30 p-5 rounded-xl text-center">
            <p className="text-sm text-[#EF4444] mb-5 font-medium">
              Failed to generate Mindmap. Please try again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleGenerate(focusTopic)}
                className="flex-1 py-2.5 text-sm text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg transition-colors font-medium shadow-md shadow-[#EF4444]/20"
              >
                Retry
              </button>
              <button
                onClick={reset}
                className="px-5 py-2.5 text-sm text-[#9CA3AF] hover:text-[#F3F4F6] bg-[#374151] hover:bg-[#4B5563] rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alert Modal */}
      {alertMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setAlertMessage(null)}
        >
          <div
            className="bg-[#1F2937] border border-[#374151] rounded-xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertCircle className="h-10 w-10 text-[#3B82F6] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#F3F4F6] mb-2">
              Processing Document
            </h3>
            <p className="text-sm text-[#9CA3AF] mb-6">{alertMessage}</p>
            <button
              onClick={() => setAlertMessage(null)}
              className="w-full py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
