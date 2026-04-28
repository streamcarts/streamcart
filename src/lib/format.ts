export const inr = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v || 0);
};

export const calcDisplayPrice = (base: number) => Math.round(base * 110) / 100;
