import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

const chartConfig = {
  billed: { label: "Billed", color: "#E11D2C" },
  collected: { label: "Collected", color: "#C9CCD4" },
};

export function RevenueChart({ data = [], className }) {
  const uid = useId().replace(/:/g, "");
  const idBilledGrad = `billed-grad-${uid}`;
  const idCollectedGrad = `collected-grad-${uid}`;

  const totalBilled = data.reduce((s, r) => s + (r.billed || 0), 0);
  const totalCollected = data.reduce((s, r) => s + (r.collected || 0), 0);
  const collectionPct = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : 0;

  const first = data[0]?.billed ?? 0;
  const last = data[data.length - 1]?.billed ?? first;
  const growthPct = first > 0 ? ((last - first) / first) * 100 : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
        <p className="text-muted-foreground text-xs">
          Billed vs collected · last {data.length} months · {collectionPct}% collected
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-auto h-56 w-full p-0" config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={[...data]}
            margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={idBilledGrad} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#E11D2C" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#E11D2C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={idCollectedGrad} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#C9CCD4" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#C9CCD4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal={false} strokeDasharray="2 2" />
            <XAxis
              axisLine={false}
              dataKey="m"
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Area
              dataKey="billed"
              dot={false}
              fill={`url(#${idBilledGrad})`}
              stroke="#E11D2C"
              strokeWidth={2}
              type="monotone"
            />
            <Area
              dataKey="collected"
              dot={false}
              fill={`url(#${idCollectedGrad})`}
              stroke="#C9CCD4"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Delta value={growthPct}>
            <DeltaIcon />
            <DeltaValue />
          </Delta>
          <p className="inline-flex text-pretty">vs first month in range</p>
        </div>
        <Button asChild className="text-muted-foreground" size="sm" variant="ghost">
          <Link to="/reports">
            View reports
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
