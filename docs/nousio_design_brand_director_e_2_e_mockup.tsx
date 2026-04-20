import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CircleDot, Loader2, Eye, RefreshCw, Download, Printer, Share2, Copy, Trash2, MoreHorizontal, Sparkles, X, PanelRightOpen, Wand2, History, MousePointerClick, ChevronRight, FileText, Layers3, MessageSquareMore, Plus, Search, Clock3 } from "lucide-react";

const cls = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

type BubbleState = "collecting" | "ready" | "generating" | "generated";
type ViewerTab = "preview" | "spec" | "annotations" | "history";
type Version = {
  id: string;
  label: string;
  summary: string;
  prompt: string;
  scope: "global" | "scoped" | "initial";
  createdAt: string;
  selectedArea?: string;
};

const progressStages = [
  "Loading company context",
  "Building wireframe logic",
  "Rendering output",
];

const initialVersions: Version[] = [
  {
    id: "v1",
    label: "v1",
    summary: "Desktop service-page wireframe for SMB service positioning",
    prompt: "Create first-pass service page wireframe for SMBs showcasing services.",
    scope: "initial",
    createdAt: "Today · 10:24",
  },
];

const previewAreas = [
  { id: "hero", label: "Hero", left: "6%", top: "8%", width: "88%", height: "18%" },
  { id: "services", label: "Services Grid", left: "6%", top: "31%", width: "88%", height: "26%" },
  { id: "why", label: "Why Disruptio", left: "6%", top: "60%", width: "42%", height: "17%" },
  { id: "process", label: "Process", left: "52%", top: "60%", width: "42%", height: "17%" },
  { id: "footer", label: "Footer", left: "6%", top: "81%", width: "88%", height: "9%" },
];

function StatusChip({ state }: { state: BubbleState }) {
  const config = {
    collecting: { label: "Collecting inputs", icon: CircleDot, tone: "bg-slate-100 text-slate-700 border-slate-300" },
    ready: { label: "Ready to generate", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700 border-emerald-300" },
    generating: { label: "Generating", icon: Loader2, tone: "bg-amber-50 text-amber-700 border-amber-300" },
    generated: { label: "Generated", icon: Sparkles, tone: "bg-blue-50 text-blue-700 border-blue-300" },
  }[state];

  const Icon = config.icon;
  return (
    <div className={cls("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold", config.tone)}>
      <Icon className={cls("h-4 w-4", state === "generating" && "animate-spin")} />
      {config.label}
    </div>
  );
}

function AssistantBubble({
  state,
  progressIndex,
  onGenerate,
  onView,
  canGenerate,
}: {
  state: BubbleState;
  progressIndex: number;
  onGenerate: () => void;
  onView: () => void;
  canGenerate: boolean;
}) {
  const helperText = {
    collecting: "Need 2 more inputs: audience, goal",
    ready: "Ready to generate wireframe",
    generating: progressStages[progressIndex] ?? progressStages[0],
    generated: "Draft generated. Open view to inspect and iterate.",
  }[state];

  return (
    <div className="rounded-[28px] border-[3px] border-slate-900 bg-white shadow-[6px_6px_0_0_rgba(15,23,42,1)] overflow-hidden">
      <div className="border-b-[3px] border-slate-900 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-slate-900 bg-blue-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-slate-900">NOUSIO</div>
                <div className="text-xs text-slate-500">Design & Brand Director</div>
              </div>
            </div>
            <p className="max-w-3xl text-[18px] font-medium leading-8 text-slate-900">
              {state === "collecting" && "Need the target audience and main goal before I generate the wireframe."}
              {state === "ready" && "Perfect — I have enough to produce a first-pass service page wireframe."}
              {state === "generating" && "Generating the draft inside this same assistant bubble so the thread stays clean."}
              {state === "generated" && "Your first draft is ready."}
            </p>
          </div>
          <StatusChip state={state} />
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span className="rounded-full border-2 border-slate-900 bg-slate-50 px-3 py-1 font-semibold">Audience: SMB</span>
          <span className="rounded-full border-2 border-slate-900 bg-slate-50 px-3 py-1 font-semibold">Goal: Showcase services</span>
          <span className="rounded-full border-2 border-slate-900 bg-slate-50 px-3 py-1 font-semibold">Type: Wireframing</span>
          <span className="rounded-full border-2 border-slate-900 bg-slate-50 px-3 py-1 font-semibold">Version: {state === "generated" ? "v1" : "Draft pending"}</span>
        </div>

        {state === "generating" && (
          <div className="rounded-2xl border-[3px] border-slate-900 bg-slate-50 p-4">
            <div className="space-y-3">
              {progressStages.map((item, index) => {
                const active = index === progressIndex;
                const done = index < progressIndex;
                return (
                  <div key={item} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <div className={cls(
                      "grid h-8 w-8 place-items-center rounded-full border-[3px] border-slate-900",
                      done && "bg-emerald-200",
                      active && "bg-amber-200",
                      !done && !active && "bg-white"
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDot className="h-4 w-4" />}
                    </div>
                    <span>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state === "generated" && (
          <div className="rounded-2xl border-[3px] border-slate-900 bg-blue-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-black text-slate-900">Service Page Wireframe — Test</div>
                <div className="text-sm text-slate-600">Desktop wireframe for SMB service positioning</div>
              </div>
              <div className="rounded-full border-2 border-slate-900 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                Persistent output card
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t-[3px] border-slate-900 bg-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {state !== "generated" ? (
            <button
              onClick={onGenerate}
              disabled={!canGenerate || state === "collecting" || state === "generating"}
              className={cls(
                "inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 px-5 py-3 text-base font-black shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition",
                state === "generating" ? "bg-amber-200 text-slate-900" : "bg-blue-600 text-white",
                (!canGenerate || state === "collecting") && "cursor-not-allowed bg-slate-200 text-slate-400 shadow-none"
              )}
            >
              {state === "generating" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {state === "generating" ? "Generating…" : "Generate draft"}
            </button>
          ) : (
            <>
              <button onClick={onView} className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-blue-600 px-5 py-3 text-base font-black text-white shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                <Eye className="h-5 w-5" />
                View
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 font-bold text-slate-900">
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 font-bold text-slate-900">
                <Download className="h-4 w-4" />
                Export
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 font-bold text-slate-900">
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 font-bold text-slate-900">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">{helperText}</div>
      </div>
    </div>
  );
}

function ThreadMessage({ side = "assistant", children }: { side?: "assistant" | "user"; children: React.ReactNode }) {
  return (
    <div className={cls("flex gap-4", side === "user" && "justify-end")}>
      {side === "assistant" && (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-slate-900 bg-blue-600 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
      )}
      <div className={cls(
        "max-w-3xl rounded-[24px] border-[3px] border-slate-900 bg-white px-5 py-4 text-[17px] leading-8 text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)]",
        side === "user" && "bg-slate-900 text-white"
      )}>
        {children}
      </div>
      {side === "user" && (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-slate-900 bg-slate-100 text-slate-900">
          <span className="text-sm font-black">IS</span>
        </div>
      )}
    </div>
  );
}

function PreviewCanvas({
  selectionMode,
  selectedArea,
  onSelectArea,
}: {
  selectionMode: boolean;
  selectedArea: string | null;
  onSelectArea: (id: string) => void;
}) {
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-[28px] border-[3px] border-slate-900 bg-[#171a2c] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
      <div className="border-b border-white/20 px-6 py-5 text-white/90">
        <div className="mb-4 flex items-center justify-between text-sm font-bold uppercase tracking-[0.25em] text-white/60">
          <span>Desktop wireframe</span>
          <span>Service page · SMB</span>
        </div>
        <div className="grid grid-cols-[140px_1fr_140px] items-center gap-4 rounded-xl border border-white/20 px-4 py-4 text-white/90">
          <div className="font-black">[Logo]</div>
          <div className="flex items-center justify-center gap-6 text-sm font-semibold">
            <span>Services</span>
            <span>About</span>
            <span>Case Studies</span>
            <span>Contact</span>
          </div>
          <div className="text-right font-black">[Book Call]</div>
        </div>
      </div>

      <div className="p-6 text-white/90">
        <div className="mb-5 rounded-2xl border border-white/20 p-5">
          <div className="mb-2 text-[28px] font-black">Headline: Build real AI systems, not presentations</div>
          <div className="mb-4 max-w-3xl text-sm text-white/70">Subtext: We design, implement, and operate practical digital and AI systems for growing companies with complex workflows.</div>
          <div className="flex gap-3 text-sm font-bold">
            <span className="rounded-full border border-white/30 px-4 py-2">Primary CTA: Schedule Discovery Call</span>
            <span className="rounded-full border border-white/30 px-4 py-2">Secondary CTA: View Services</span>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-white/20 p-5">
          <div className="mb-4 text-lg font-black">Trusted for SMB operations</div>
          <div className="text-sm text-white/70">Short intro focused on reducing manual work, fragmented tools, and delays.</div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-5">
          {[
            "AI System Design",
            "AI Implementation",
            "Process Automation",
            "Optimization & Operation",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/20 p-5">
              <div className="mb-2 text-lg font-black">{item}</div>
              <div className="text-sm text-white/70">Outcome-focused description for non-technical decision-makers.</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/20 p-5">
            <div className="mb-3 text-lg font-black">Why Disruptio?</div>
            <ul className="space-y-2 text-sm text-white/80">
              <li>Product + execution model</li>
              <li>Practical systems from the start</li>
              <li>Built for SMB operational complexity</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/20 p-5">
            <div className="mb-3 text-lg font-black">3-step process</div>
            <div className="text-sm text-white/80">Discover → Build → Operate</div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0">
        {previewAreas.map((area) => {
          const isSelected = selectedArea === area.id;
          return (
            <button
              key={area.id}
              disabled={!selectionMode}
              onClick={() => onSelectArea(area.id)}
              style={{ left: area.left, top: area.top, width: area.width, height: area.height }}
              className={cls(
                "absolute rounded-2xl border-2 text-left transition",
                selectionMode ? "cursor-crosshair border-dashed border-blue-300/70 bg-blue-200/10 hover:bg-blue-200/20" : "pointer-events-none border-transparent",
                isSelected && "border-[3px] border-amber-300 bg-amber-300/15"
              )}
            >
              {selectionMode && (
                <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-xs font-black text-slate-900">{area.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function NousioDesignBrandDirectorMockup() {
  const [bubbleState, setBubbleState] = useState<BubbleState>("ready");
  const [progressIndex, setProgressIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTab, setViewerTab] = useState<ViewerTab>("preview");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [scopedPrompt, setScopedPrompt] = useState("");
  const [isIterating, setIsIterating] = useState(false);

  const currentVersion = versions[versions.length - 1];

  const quickScreens = [
    { id: "collecting", label: "1. Collecting" },
    { id: "ready", label: "2. Ready" },
    { id: "generating", label: "3. Generating" },
    { id: "generated", label: "4. Generated" },
    { id: "viewer", label: "5. Viewer" },
    { id: "iterate", label: "6. Iterate" },
    { id: "scoped", label: "7. Select area" },
  ];

  const handleGenerate = () => {
    if (bubbleState === "generating") return;
    setBubbleState("generating");
    setProgressIndex(0);
    setViewerOpen(false);
    setSelectionMode(false);
    setSelectedArea(null);

    window.setTimeout(() => setProgressIndex(1), 900);
    window.setTimeout(() => setProgressIndex(2), 1800);
    window.setTimeout(() => {
      setBubbleState("generated");
    }, 2800);
  };

  const openViewer = () => {
    setViewerOpen(true);
    setViewerTab("preview");
  };

  const jumpTo = (id: string) => {
    setSelectionMode(false);
    setSelectedArea(null);
    setViewerOpen(false);
    setIterationPrompt("");
    setScopedPrompt("");

    if (id === "collecting") {
      setBubbleState("collecting");
      setProgressIndex(0);
      return;
    }
    if (id === "ready") {
      setBubbleState("ready");
      setProgressIndex(0);
      return;
    }
    if (id === "generating") {
      setBubbleState("generating");
      setProgressIndex(1);
      return;
    }
    if (id === "generated") {
      setBubbleState("generated");
      return;
    }
    if (id === "viewer") {
      setBubbleState("generated");
      setViewerOpen(true);
      setViewerTab("preview");
      return;
    }
    if (id === "iterate") {
      setBubbleState("generated");
      setViewerOpen(true);
      setViewerTab("history");
      return;
    }
    if (id === "scoped") {
      setBubbleState("generated");
      setViewerOpen(true);
      setViewerTab("preview");
      setSelectionMode(true);
      return;
    }
  };

  const applyGlobalIteration = () => {
    if (!iterationPrompt.trim()) return;
    setIsIterating(true);
    window.setTimeout(() => {
      const nextVersionNumber = versions.length + 1;
      setVersions((prev) => [
        ...prev,
        {
          id: `v${nextVersionNumber}`,
          label: `v${nextVersionNumber}`,
          summary: "Refined hero with stronger CTA and clearer service framing",
          prompt: iterationPrompt,
          scope: "global",
          createdAt: "Today · 10:29",
        },
      ]);
      setIterationPrompt("");
      setViewerTab("history");
      setIsIterating(false);
    }, 900);
  };

  const applyScopedIteration = () => {
    if (!selectedArea || !scopedPrompt.trim()) return;
    setIsIterating(true);
    window.setTimeout(() => {
      const nextVersionNumber = versions.length + 1;
      const areaLabel = previewAreas.find((item) => item.id === selectedArea)?.label ?? selectedArea;
      setVersions((prev) => [
        ...prev,
        {
          id: `v${nextVersionNumber}`,
          label: `v${nextVersionNumber}`,
          summary: `Scoped edit to ${areaLabel}`,
          prompt: scopedPrompt,
          scope: "scoped",
          selectedArea: areaLabel,
          createdAt: "Today · 10:31",
        },
      ]);
      setScopedPrompt("");
      setSelectionMode(false);
      setSelectedArea(null);
      setViewerTab("history");
      setIsIterating(false);
    }, 900);
  };

  const timeline = useMemo(() => [
    { title: "Intent captured", body: "Wireframing selected as the task type for a service-page artifact." },
    { title: "Minimum viable inputs", body: "Audience, goal, topic, and content type are used to enable generation." },
    { title: "Inline generation state", body: "The assistant bubble becomes the only control surface for readiness and generation." },
    { title: "Persistent artifact", body: "After generation, the bubble turns into a compact output card with View, Regenerate, and Export." },
    { title: "Viewer-led iteration", body: "All refinement happens from the output viewer, with version history and scoped edits." },
  ], []);

  return (
    <div className="min-h-screen bg-[#f5f2eb] text-slate-900">
      <div className="border-b-[3px] border-slate-900 bg-[#f8f6f1] px-6 py-5">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border-[3px] border-slate-900 bg-white px-4 py-2 text-2xl font-black tracking-tight text-blue-600">nousio</div>
            <div>
              <div className="text-4xl font-black tracking-tight">DESIGN & BRAND DIRECTOR</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">E2E feature mockup · assistant bubble as state machine</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-2xl border-[3px] border-slate-900 bg-blue-600 px-5 py-3 font-black text-white shadow-[3px_3px_0_0_rgba(15,23,42,1)]">+ NEW</button>
            <button className="rounded-2xl border-[3px] border-slate-900 bg-white px-5 py-3 font-black">HISTORY</button>
            <button className="rounded-2xl border-[3px] border-slate-900 bg-white px-5 py-3 font-black">SELECT WORKSPACE</button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] grid-cols-[260px_1fr] gap-6 p-6">
        <aside className="rounded-[28px] border-[3px] border-slate-900 bg-white p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)]">
          <div className="mb-5 space-y-3">
            {[
              "AI TEAM",
              "SKILL LIBRARY",
              "DOCUMENTS",
              "BOARDROOM",
              "SEARCH",
              "TASKS",
              "COMPANY DNA",
              "SALES ASSISTANT",
              "DISCOVERY LEAD",
              "PRODUCT ASSISTANT",
              "IMPLEMENTATION ENGINEER",
              "DELIVERY SUCCESS LEAD",
            ].map((item) => (
              <div key={item} className={cls(
                "rounded-2xl border-[3px] px-4 py-3 text-sm font-black",
                item === "PRODUCT ASSISTANT" ? "border-slate-900 bg-slate-900 text-white" : "border-transparent bg-slate-50 text-slate-700"
              )}>
                {item}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border-[3px] border-slate-900 bg-blue-600 px-4 py-4 text-white shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
            <div className="text-xs font-black uppercase tracking-wide text-white/70">Active agent</div>
            <div className="mt-1 text-lg font-black">DESIGN & BRAND DIRECTOR</div>
          </div>

          <div className="mt-5 rounded-2xl border-[3px] border-slate-900 bg-slate-50 p-4">
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Jump to remaining screens</div>
            <div className="space-y-2">
              {quickScreens.map((item) => (
                <button
                  key={item.id}
                  onClick={() => jumpTo(item.id)}
                  className="flex w-full items-center justify-between rounded-xl border-[3px] border-slate-900 bg-white px-3 py-3 text-left text-sm font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <div className="rounded-[28px] border-[3px] border-slate-900 bg-white p-4 shadow-[5px_5px_0_0_rgba(15,23,42,1)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border-[3px] border-slate-900 bg-slate-100 px-4 py-2 text-sm font-black">Prototype controls</span>
              <button onClick={() => jumpTo("ready")} className="rounded-full border-[3px] border-slate-900 bg-white px-4 py-2 text-sm font-bold">Reset to ready</button>
              <button onClick={handleGenerate} className="rounded-full border-[3px] border-slate-900 bg-blue-600 px-4 py-2 text-sm font-black text-white">Run generation</button>
              <button onClick={openViewer} className="rounded-full border-[3px] border-slate-900 bg-white px-4 py-2 text-sm font-bold">Open viewer</button>
              <button onClick={() => { setViewerOpen(true); setViewerTab("history"); }} className="rounded-full border-[3px] border-slate-900 bg-white px-4 py-2 text-sm font-bold">Open history</button>
            </div>
          </div>

          <ThreadMessage>
            Got it — topic is “test” and we’ll keep wireframing as the content type. Who is this wireframe for — internal teams, SMB decision-makers, or end users?
          </ThreadMessage>

          <ThreadMessage side="user">SMB</ThreadMessage>

          <ThreadMessage>
            Great — target audience is SMBs. What’s the main goal of this wireframe: explain a product, drive sign-ups, or showcase services?
          </ThreadMessage>

          <ThreadMessage side="user">Showcase services</ThreadMessage>

          <AssistantBubble
            state={bubbleState}
            progressIndex={progressIndex}
            onGenerate={handleGenerate}
            onView={openViewer}
            canGenerate={bubbleState !== "collecting"}
          />

          <div className="rounded-[28px] border-[3px] border-dashed border-slate-400 bg-white/70 px-5 py-4">
            <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Why this flow works</div>
            <div className="grid gap-3 md:grid-cols-5">
              {timeline.map((item) => (
                <div key={item.title} className="rounded-2xl border-[3px] border-slate-900 bg-slate-50 p-4">
                  <div className="mb-2 text-sm font-black">{item.title}</div>
                  <div className="text-sm leading-6 text-slate-600">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {viewerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/45 p-6 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              className="mx-auto flex h-[92vh] max-w-[1400px] flex-col overflow-hidden rounded-[32px] border-[4px] border-slate-900 bg-[#f8f6f1] shadow-[10px_10px_0_0_rgba(15,23,42,1)]"
            >
              <div className="flex items-start justify-between gap-4 border-b-[4px] border-slate-900 bg-white px-6 py-5">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border-[3px] border-slate-900 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700">Wireframing</span>
                    <span className="rounded-full border-[3px] border-slate-900 bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide">{currentVersion.label}</span>
                    <span className="rounded-full border-[3px] border-slate-900 bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide">April 5, 2026 · 10:24</span>
                  </div>
                  <div className="text-4xl font-black tracking-tight">SERVICE PAGE WIREFRAME — TEST</div>
                  <div className="mt-2 text-sm font-semibold text-slate-500">Full artifact viewer for preview, spec, annotations, and version history</div>
                </div>
                <button onClick={() => setViewerOpen(false)} className="rounded-2xl border-[3px] border-slate-900 bg-white p-3 text-slate-900">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-b-[3px] border-slate-900 bg-[#f8f6f1] px-6 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { id: "preview", label: "Preview", icon: Eye },
                    { id: "spec", label: "Spec", icon: FileText },
                    { id: "annotations", label: "Annotations", icon: PanelRightOpen },
                    { id: "history", label: "History", icon: History },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = viewerTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setViewerTab(item.id as ViewerTab)}
                        className={cls(
                          "inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 px-4 py-3 text-sm font-black shadow-[2px_2px_0_0_rgba(15,23,42,1)]",
                          active ? "bg-blue-600 text-white" : "bg-white text-slate-900"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-0">
                <div className="min-h-0 overflow-auto border-r-[3px] border-slate-900 p-6">
                  {viewerTab === "preview" && (
                    <div className="space-y-5">
                      <PreviewCanvas
                        selectionMode={selectionMode}
                        selectedArea={selectedArea}
                        onSelectArea={(id) => {
                          setSelectedArea(id);
                          if (!scopedPrompt) {
                            const areaLabel = previewAreas.find((item) => item.id === id)?.label ?? id;
                            setScopedPrompt(`Improve ${areaLabel.toLowerCase()} clarity and strengthen the CTA.`);
                          }
                        }}
                      />

                      <div className="rounded-[24px] border-[3px] border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => {
                              setSelectionMode((prev) => !prev);
                              setSelectedArea(null);
                            }}
                            className={cls(
                              "inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 px-4 py-3 text-sm font-black",
                              selectionMode ? "bg-amber-200" : "bg-white"
                            )}
                          >
                            <MousePointerClick className="h-4 w-4" />
                            {selectionMode ? "Selection mode on" : "Select area"}
                          </button>
                          <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 text-sm font-black">
                            <Wand2 className="h-4 w-4" />
                            Generate 2 variants
                          </button>
                        </div>

                        {selectionMode ? (
                          <div className="rounded-2xl border-[3px] border-slate-900 bg-amber-50 p-4">
                            <div className="mb-2 text-sm font-black uppercase tracking-wide text-amber-700">Scoped iteration</div>
                            <div className="mb-3 text-sm text-slate-700">Click a preview region, then describe only the change for that selected area.</div>
                            <textarea
                              value={scopedPrompt}
                              onChange={(e) => setScopedPrompt(e.target.value)}
                              placeholder="Describe what to change in selected area"
                              className="min-h-[110px] w-full rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 text-sm font-medium outline-none"
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <button
                                onClick={applyScopedIteration}
                                disabled={!selectedArea || !scopedPrompt.trim() || isIterating}
                                className={cls(
                                  "inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 px-4 py-3 text-sm font-black shadow-[2px_2px_0_0_rgba(15,23,42,1)]",
                                  !selectedArea || !scopedPrompt.trim() ? "bg-slate-200 text-slate-400 shadow-none" : "bg-blue-600 text-white"
                                )}
                              >
                                {isIterating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers3 className="h-4 w-4" />}
                                Create scoped edit
                              </button>
                              <div className="text-sm font-semibold text-slate-600">
                                Selected area: {selectedArea ? previewAreas.find((item) => item.id === selectedArea)?.label : "None yet"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border-[3px] border-slate-900 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                            Use View to inspect the artifact, Iterate for global changes, or Select area for scoped redesign. This keeps refinement anchored to the output instead of forcing the user back into the chat thread.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {viewerTab === "spec" && (
                    <div className="space-y-5">
                      <div className="rounded-[24px] border-[3px] border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                        <div className="mb-4 text-2xl font-black">Structured spec</div>
                        <div className="grid gap-4 md:grid-cols-2">
                          {[
                            ["Objective", "Turn the assistant bubble into the single control surface for readiness, generation, and artifact access."],
                            ["Primary user", "SMB-focused team member working through Design & Brand Director inside Nousio."],
                            ["Thread behavior", "Keep conversation lightweight. Do not dump the full artifact into the chat by default."],
                            ["Output model", "Compact generated state in thread + dedicated modal viewer for heavy artifact interaction."],
                            ["Iteration model", "Global iteration from prompt composer and scoped iteration from selected preview region."],
                            ["Versioning", "Every refinement creates a new version with parent, scope, timestamp, and prompt."],
                          ].map(([title, body]) => (
                            <div key={title} className="rounded-2xl border-[3px] border-slate-900 bg-slate-50 p-4">
                              <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">{title}</div>
                              <div className="text-sm leading-7 text-slate-700">{body}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[24px] border-[3px] border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                        <div className="mb-4 text-2xl font-black">State logic</div>
                        <div className="overflow-hidden rounded-2xl border-[3px] border-slate-900">
                          <div className="grid grid-cols-4 border-b-[3px] border-slate-900 bg-slate-900 text-sm font-black uppercase tracking-wide text-white">
                            <div className="p-3">State</div>
                            <div className="p-3">Condition</div>
                            <div className="p-3">Primary action</div>
                            <div className="p-3">Displayed helper</div>
                          </div>
                          {[
                            ["Collecting", "Required slots missing", "Disabled Generate draft", "Need audience and goal before generating"],
                            ["Ready", "Minimum viable inputs collected", "Enabled Generate draft", "Ready to generate wireframe"],
                            ["Generating", "Generation in progress", "Generating…", "Progress steps inside same bubble"],
                            ["Generated", "Output exists", "View + secondary actions", "Draft generated. Open view to inspect and iterate"],
                          ].map((row) => (
                            <div key={row[0]} className="grid grid-cols-4 border-b border-slate-300 bg-white text-sm">
                              {row.map((cell) => (
                                <div key={cell} className="p-3 leading-6">{cell}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {viewerTab === "annotations" && (
                    <div className="space-y-5">
                      {[
                        ["Assistant bubble", "Owns the full generation state machine so the user never leaves the conversation context."],
                        ["Sticky action row", "Keeps the main action visible at the bottom of the bubble regardless of content height."],
                        ["Viewer modal", "Treats the output as a persistent asset instead of a transient chat message."],
                        ["Selection mode", "Enables scoped redesign without editing the whole artifact."],
                        ["History tab", "Makes versioning explicit and supports a more product-like refinement loop."],
                      ].map(([title, note], index) => (
                        <div key={title} className="rounded-[24px] border-[3px] border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                          <div className="mb-3 flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-slate-900 bg-blue-600 text-white font-black">{index + 1}</div>
                            <div className="text-xl font-black">{title}</div>
                          </div>
                          <div className="rounded-2xl border-[3px] border-slate-900 bg-slate-50 p-4 text-sm leading-7 text-slate-700">{note}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewerTab === "history" && (
                    <div className="space-y-5">
                      <div className="rounded-[24px] border-[3px] border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <div className="text-2xl font-black">Version history</div>
                            <div className="text-sm font-semibold text-slate-500">Every new refinement becomes a persistent version.</div>
                          </div>
                          <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 text-sm font-black">
                            <Clock3 className="h-4 w-4" />
                            Compare versions
                          </button>
                        </div>
                        <div className="space-y-4">
                          {[...versions].reverse().map((version, index) => (
                            <div key={version.id} className="rounded-2xl border-[3px] border-slate-900 bg-slate-50 p-4">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border-[3px] border-slate-900 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide">{version.label}</span>
                                <span className="rounded-full border-[3px] border-slate-900 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide">{version.scope}</span>
                                <span className="text-xs font-semibold text-slate-500">{version.createdAt}</span>
                                {index === 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">Current</span>}
                              </div>
                              <div className="text-lg font-black text-slate-900">{version.summary}</div>
                              <div className="mt-2 text-sm leading-7 text-slate-700">Prompt: {version.prompt}</div>
                              {version.selectedArea && <div className="mt-1 text-sm font-semibold text-slate-500">Selected area: {version.selectedArea}</div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[24px] border-[3px] border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                        <div className="mb-3 text-2xl font-black">Global iteration</div>
                        <div className="mb-4 text-sm leading-7 text-slate-700">Create v2, v3, and later versions from the existing output instead of restarting the conversation.</div>
                        <textarea
                          value={iterationPrompt}
                          onChange={(e) => setIterationPrompt(e.target.value)}
                          placeholder="Example: Make hero clearer and add a stronger CTA"
                          className="min-h-[120px] w-full rounded-2xl border-[3px] border-slate-900 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
                        />
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            onClick={applyGlobalIteration}
                            disabled={!iterationPrompt.trim() || isIterating}
                            className={cls(
                              "inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 px-5 py-3 text-sm font-black shadow-[2px_2px_0_0_rgba(15,23,42,1)]",
                              !iterationPrompt.trim() ? "bg-slate-200 text-slate-400 shadow-none" : "bg-blue-600 text-white"
                            )}
                          >
                            {isIterating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareMore className="h-4 w-4" />}
                            Create next version
                          </button>
                          <button
                            onClick={() => setIterationPrompt("Make hero clearer and add stronger CTA")}
                            className="rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 text-sm font-black"
                          >
                            Use sample prompt
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-h-0 overflow-auto bg-white p-5">
                  <div className="mb-4 rounded-[24px] border-[3px] border-slate-900 bg-slate-50 p-4 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                    <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                      <Search className="h-4 w-4" />
                      Quick actions
                    </div>
                    <div className="grid gap-3">
                      {[
                        [Eye, "View live artifact"],
                        [RefreshCw, "Regenerate from same prompt"],
                        [Wand2, "Iterate from current version"],
                        [MousePointerClick, "Scoped redesign"],
                        [Download, "Export md, pdf, zip"],
                        [Printer, "Print viewer"],
                        [Share2, "Share output"],
                      ].map(([Icon, label]) => {
                        const I = Icon as typeof Eye;
                        return (
                          <button key={label} className="flex items-center justify-between rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 text-left text-sm font-black shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                            <span className="flex items-center gap-2"><I className="h-4 w-4" />{label}</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-4 rounded-[24px] border-[3px] border-slate-900 bg-slate-50 p-4 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                    <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Artifact summary</div>
                    <div className="space-y-3 text-sm leading-7 text-slate-700">
                      <div className="rounded-2xl border-[3px] border-slate-900 bg-white p-3"><strong>Title:</strong> Service Page Wireframe — Test</div>
                      <div className="rounded-2xl border-[3px] border-slate-900 bg-white p-3"><strong>Goal:</strong> Showcase services</div>
                      <div className="rounded-2xl border-[3px] border-slate-900 bg-white p-3"><strong>Audience:</strong> SMB</div>
                      <div className="rounded-2xl border-[3px] border-slate-900 bg-white p-3"><strong>Status:</strong> Generated</div>
                      <div className="rounded-2xl border-[3px] border-slate-900 bg-white p-3"><strong>Current version:</strong> {currentVersion.label}</div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border-[3px] border-slate-900 bg-slate-50 p-4 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                    <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Overflow menu</div>
                    <div className="grid gap-3">
                      {[
                        [Copy, "Copy link"],
                        [Share2, "Share"],
                        [Plus, "Duplicate"],
                        [Trash2, "Delete"],
                      ].map(([Icon, label]) => {
                        const I = Icon as typeof Copy;
                        return (
                          <div key={label} className="flex items-center gap-3 rounded-2xl border-[3px] border-slate-900 bg-white px-4 py-3 text-sm font-black">
                            <I className="h-4 w-4" />
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t-[4px] border-slate-900 bg-white px-6 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                    <Wand2 className="h-4 w-4" />
                    Iterate
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-5 py-3 text-sm font-black">
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-5 py-3 text-sm font-black">
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-5 py-3 text-sm font-black">
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-5 py-3 text-sm font-black">
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  <button onClick={() => setViewerOpen(false)} className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-slate-900 bg-white px-5 py-3 text-sm font-black">
                    <X className="h-4 w-4" />
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
