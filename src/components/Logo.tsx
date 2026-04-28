import logo from "@/assets/logo.png";

export const Logo = ({ size = 36 }: { size?: number }) => (
  <div className="flex items-center gap-2">
    <img src={logo} alt="StreamCart logo" width={size} height={size} className="rounded-full" />
    <span className="font-bold text-lg tracking-tight">StreamCart</span>
  </div>
);
