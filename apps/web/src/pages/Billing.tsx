const BILLS = [
  { period: "2026年6月", amount: "¥ 128.00", status: "已支付" },
  { period: "2026年5月", amount: "¥ 96.50", status: "已支付" },
  { period: "2026年4月", amount: "¥ 112.00", status: "已支付" },
] as const;

export function Billing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">计费</h1>
        <p className="text-muted-foreground mt-1">查看账单和用量明细</p>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          {BILLS.map(({ period, amount, status }) => (
            <div
              key={period}
              className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
            >
              <div>
                <p className="font-medium">{period}</p>
                <p className="text-sm text-muted-foreground">{status}</p>
              </div>
              <p className="font-semibold">{amount}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
