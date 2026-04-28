import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

const Success = () => {
  const [params] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);

  useEffect(() => {
    document.title = "Order confirmed — StreamCart";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-16 max-w-xl">
        <div className="card-elevated p-10 text-center animate-in fade-in zoom-in duration-500">
          <div className="relative inline-flex">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mt-6 mb-2">Order confirmed!</h1>
          <p className="text-muted-foreground mb-2">
            {ids.length} {ids.length === 1 ? "item" : "items"} purchased successfully.
          </p>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Credentials are ready in your dashboard
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg"><Link to="/buyer">View credentials <ArrowRight className="h-4 w-4 ml-1.5" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/browse">Continue shopping</Link></Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Success;
