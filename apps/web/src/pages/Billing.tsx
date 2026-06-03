import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2, TrendingUp, DollarSign, Activity, Video, Image as ImageIcon, FileText } from "lucide-react";

interface Statistics {
  totalCost: number;
  todayCost: number;
  weekCost: number;
  monthCost: number;
  totalRecords: number;
  modelStats: Array<{
    model: string;
    modelName: string;
    count: number;
    cost: number;
  }>;
  categoryStats: Array<{
    category: string;
    count: number;
    cost: number;
  }>;
  dailyTrend: Array<{
    date: string;
    cost: number;
  }>;
}

const CATEGORY_INFO = {
  text: { name: '文本生成', icon: FileText, color: 'text-blue-500' },
  image: { name: '图像生成', icon: ImageIcon, color: 'text-purple-500' },
  video: { name: '视频生成', icon: Video, color: 'text-pink-500' },
} as const;

export function Billing() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
    const interval = setInterval(loadStatistics, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await api.bailian.getStatistics();
      setStats(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => `¥${price.toFixed(4)}`;

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5">
          <DollarSign className="w-6 h-6 text-green-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">计费统计</h1>
          <p className="text-muted-foreground mt-1">查看AI模型使用费用统计</p>
        </div>
      </div>

      {/* 总览卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">总消费</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{formatPrice(stats.totalCost)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日消费</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{formatPrice(stats.todayCost)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">本周消费</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{formatPrice(stats.weekCost)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">本月消费</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold">{formatPrice(stats.monthCost)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 各类别消费统计 */}
      <Card>
        <CardHeader>
          <CardTitle>各类别消费统计</CardTitle>
          <CardDescription>按类别分组的费用明细</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.categoryStats.map((cat) => {
              const info = CATEGORY_INFO[cat.category as keyof typeof CATEGORY_INFO];
              if (!info) return null;
              const Icon = info.icon;
              const percentage = (cat.cost / stats.totalCost) * 100;

              return (
                <div key={cat.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${info.color}`} />
                      <span className="font-medium">{info.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{formatPrice(cat.cost)}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({cat.count}次)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    占比 {percentage.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 各模型消费统计 */}
      <Card>
        <CardHeader>
          <CardTitle>各模型消费统计</CardTitle>
          <CardDescription>按模型分组的费用明细</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.modelStats
              .sort((a, b) => b.cost - a.cost)
              .map((model) => {
                const percentage = (model.cost / stats.totalCost) * 100;

                return (
                  <div key={model.model} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{model.modelName}</span>
                      <div className="text-right">
                        <span className="font-bold">{formatPrice(model.cost)}</span>
                        <span className="text-muted-foreground ml-2">({model.count}次)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* 每日消费趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>每日消费趋势</CardTitle>
          <CardDescription>最近30天的消费情况</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.dailyTrend.every(d => d.cost === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Activity className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">暂无消费数据</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {stats.dailyTrend
                .filter(day => day.cost > 0)
                .map((day) => {
                  const maxCost = Math.max(...stats.dailyTrend.map(d => d.cost), 0.01);
                  const widthPct = Math.max((day.cost / maxCost) * 100, 2);
                  const date = new Date(day.date + "T00:00:00");
                  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

                  return (
                    <div key={day.date} className="flex items-center gap-3 text-sm group">
                      <span className="w-12 shrink-0 text-muted-foreground text-xs">{dateStr}</span>
                      <div className="flex-1 h-7 bg-muted rounded-sm overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-primary/60 rounded-sm transition-all group-hover:bg-primary/80"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right font-medium text-xs">
                        {formatPrice(day.cost)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
