import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { euro } from "./format";
export default function CostChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          isAnimationActive={false}
          innerRadius="60%"
          outerRadius="85%"
          paddingAngle={3}
          stroke="none"
        >
          {data.map((item, index) => (
            <Cell key={item.name} fill={index ? "#b7d9c8" : "#1a6552"} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => euro(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
