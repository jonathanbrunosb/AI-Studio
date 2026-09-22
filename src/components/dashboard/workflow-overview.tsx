import { workflowStages } from "@/data/mock-data";

export function WorkflowOverview() {
  const max = Math.max(...workflowStages.map((stage) => stage.value));
  return <div className="space-y-4 p-5 md:p-6">{workflowStages.map((stage) => <div key={stage.label}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{stage.label}</span><span className="font-bold text-slate-800">{stage.value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(8, (stage.value / max) * 100)}%`, backgroundColor: stage.color }} /></div></div>)}</div>;
}
