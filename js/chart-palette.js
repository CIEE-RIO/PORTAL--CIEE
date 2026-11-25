export const chartPalette = [
  "#003B71", "#FF7A00", "#00A3E0", "#16A34A", "#7C3AED",
  "#DC2626", "#0891B2", "#DB2777", "#65A30D", "#EA580C"
];

export function chartYearColor(year, availableYears) {
  const key = String(year);
  if (key === "2026") return chartPalette[0];
  if (key === "2025") return chartPalette[1];

  const years = [...new Set(availableYears.filter(Boolean).map(String))]
    .sort((a, b) => Number(a) - Number(b));
  const index = Math.max(0, years.indexOf(key));
  return chartPalette[index % chartPalette.length];
}
