import { Logo } from "./Logo";

export const Footer = () => (
  <footer className="border-t border-border bg-background mt-24">
    <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4">
      <Logo size={28} />
      <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} StreamCart. All rights reserved.</p>
    </div>
  </footer>
);
