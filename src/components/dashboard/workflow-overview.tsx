import { contentStatusLabels, type WorkflowStage } from "@/types/content";

export function WorkflowOverview({ stages }: { stages: WorkflowStage[] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.value));
  return <div className="space-y-4 p-5 md:p-6">{stages.map((stage) => <div key={stage.label}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{contentStatusLabels[stage.label]}</span><span className="font-bold text-slate-800">{stage.value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${stage.value === 0 ? 0 : Math.max(8, (stage.value / max) * 100)}%`, backgroundColor: stage.color }} /></div></div>)}</div>;
}
