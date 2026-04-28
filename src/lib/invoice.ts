import { inr } from "./format";

export type InvoiceData = {
  orderId: string;
  serviceName: string;
  totalPaid: number;
  buyerEmail: string;
  createdAt: string;
};

export const downloadInvoice = (d: InvoiceData) => {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Invoice ${d.orderId.slice(0, 8)}</title>
<style>
  body{font-family:-apple-system,Inter,sans-serif;padding:48px;color:#0f172a;max-width:720px;margin:0 auto}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:32px}
  .dot{width:36px;height:36px;border-radius:999px;background:#26a93f}
  h1{margin:0;font-size:22px}
  .meta{color:#64748b;font-size:13px;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th,td{text-align:left;padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px}
  th{color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  .total{font-size:20px;font-weight:700;text-align:right;padding-top:16px}
  .foot{margin-top:48px;color:#94a3b8;font-size:12px;text-align:center}
  @media print { body{padding:24px} .noprint{display:none} }
</style></head>
<body>
  <div class="brand"><div class="dot"></div><div><h1>StreamCart</h1><div class="meta">Tax invoice</div></div></div>
  <div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap">
    <div><strong>Billed to</strong><div class="meta">${d.buyerEmail}</div></div>
    <div><strong>Invoice #</strong><div class="meta">${d.orderId.slice(0, 8).toUpperCase()}</div></div>
    <div><strong>Date</strong><div class="meta">${new Date(d.createdAt).toLocaleString()}</div></div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody><tr><td>${d.serviceName} — instant credential delivery</td><td style="text-align:right">${inr(d.totalPaid)}</td></tr></tbody>
  </table>
  <div class="total">Total paid: ${inr(d.totalPaid)}</div>
  <div class="foot">Thank you for your purchase. Credentials are available in your buyer dashboard.<br/>StreamCart — streamcart.in</div>
  <div class="noprint" style="margin-top:24px;text-align:center"><button onclick="window.print()" style="padding:10px 20px;background:#26a93f;color:#fff;border:0;border-radius:8px;font-weight:600;cursor:pointer">Print / Save as PDF</button></div>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
