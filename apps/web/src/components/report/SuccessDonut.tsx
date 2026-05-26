"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Report } from "@/types";

interface SuccessDonutProps {
  report: Report;
}

export default function SuccessDonut({ report }: SuccessDonutProps) {
  const data = [
    { name: "Connected", value: report.done_count, color: "#22C55E" },
    { name: "Failed", value: report.failed_count, color: "#EF4444" },
    { name: "Skipped", value: report.skipped_count, color: "#52525B" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-4">
      <h3 className="text-sm font-semibold text-[#F4F4F5] mb-3">Call Results</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#18181B", border: "1px solid #27272A", borderRadius: "8px" }}
            labelStyle={{ color: "#F4F4F5" }}
            itemStyle={{ color: "#A1A1AA" }}
          />
          <Legend
            iconType="circle"
            formatter={(value) => <span style={{ color: "#A1A1AA", fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
