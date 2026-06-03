const METRICS = [
  { label: "活跃用户", value: "1,234" },
  { label: "请求总量", value: "56.7K" },
  { label: "响应时间", value: "23ms" },
  { label: "可用率", value: "99.9%" },
] as const;

export function Overview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">总览</h1>
        <p className="text-muted-foreground mt-1">查看系统运行状态和关键指标</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {METRICS.map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
