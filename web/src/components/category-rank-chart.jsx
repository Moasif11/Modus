import React from "react";
import { LabelList, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

const STATUS_COLORS = {
  paid: "#22C55E",
  sent: "#F59E0B",
  overdue: "#EF4444",
  partially_paid: "#6366F1",
  draft: "#9CA3AF",
  saved: "#9CA3AF",
  cancelled: "#D1D5DB",
};

const STATUS_LABELS = {
  paid: "Paid",
  sent: "Sent",
  overdue: "Overdue",
  partially_paid: "Partial",
  draft: "Draft",
  saved: "Draft",
  cancelled: "Cancelled",
};

function buildSlices(statusBreakdown) {
  const chartConfig = { share: { label: "Count" } };
  const pieData = statusBreakdown
    .filter((r) => r.count > 0)
    .map((r, i) => {
      const key = `s${i}`;
      const color = STATUS_COLORS[r.status] || "#9CA3AF";
      chartConfig[key] = { label: STATUS_LABELS[r.status] || r.status, color };
      return { key, category: STATUS_LABELS[r.status] || r.status, share: r.count, fill: color };
    });
  return { chartConfig, pieData };
}

export function CategoryRankChart({ statusBreakdown = [], totalInvoices = 0 }) {
  const { chartConfig, pieData } = React.useMemo(
    () => buildSlices(statusBreakdown),
    [statusBreakdown],
  );

  if (pieData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice status</CardTitle>
          <CardDescription>No invoices yet</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice status</CardTitle>
        <CardDescription>{totalInvoices} invoices this year</CardDescription>
      </CardHeader>
      <CardContent className="my-auto p-0">
        <ChartContainer className="aspect-auto h-64 w-full" config={chartConfig}>
          <PieChart accessibilityLayer>
            <Pie
              cornerRadius={4}
              data={pieData}
              dataKey="share"
              innerRadius={48}
              nameKey="key"
              outerRadius="84%"
              stroke="var(--card)"
              strokeWidth={3}
            >
              <LabelList
                className="fill-background font-medium"
                dataKey="share"
                fill="currentColor"
                fontWeight={500}
                formatter={(v) => String(v)}
                position="inside"
                stroke="none"
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent className="flex flex-wrap gap-2 pt-2" nameKey="key" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
