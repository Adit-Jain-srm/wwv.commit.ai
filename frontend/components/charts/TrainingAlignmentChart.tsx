"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type TrainingAlignmentDatum = {
  skill: string;
  demand: number;
  training_supply: number;
};

interface TrainingAlignmentChartProps {
  data: TrainingAlignmentDatum[];
}

export function TrainingAlignmentChart({
  data
}: TrainingAlignmentChartProps) {
  return (
    <Card className="h-[300px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader>
        <CardTitle>Training alignment — demand vs programs</CardTitle>
      </CardHeader>
      <CardContent className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 10, top: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#0f172a"
              vertical={false}
            />
            <XAxis
              dataKey="skill"
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
                borderRadius: 8,
                fontSize: 11
              }}
            />
            <Legend
              verticalAlign="top"
              height={24}
              iconSize={8}
              wrapperStyle={{ fontSize: 10 }}
            />
            <Bar
              dataKey="demand"
              name="Job demand"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="training_supply"
              name="Training capacity"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

