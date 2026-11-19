import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { euro } from "./format";
export default function CostChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={228}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          isAnimationActive={false}
          innerRadius="77%"
          outerRadius="95%"
          paddingAngle={4}
          cornerRadius={5}
          stroke="none"
        >
          {data.map((item, index) => (
            <Cell key={item.name} fill={index ? "#6ed7b2" : "#4f61f6"} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => euro(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
