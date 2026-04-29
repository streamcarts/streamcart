import { Link } from "react-router-dom";

type Platform = {
  name: string;
  query: string; // search query for /browse?q=
  slug: string;  // simpleicons slug
  color: string; // hex without #
};

type Group = { title: string; items: Platform[] };

// Logos served from simpleicons CDN — official brand SVGs, lightweight, cached.
const groups: Group[] = [
  {
    title: "OTT & Streaming",
    items: [
      { name: "Netflix", query: "Netflix", slug: "netflix", color: "E50914" },
      { name: "Prime Video", query: "Prime Video", slug: "primevideo", color: "00A8E1" },
      { name: "Disney+ Hotstar", query: "Hotstar", slug: "hotstar", color: "0F79AF" },
      { name: "SonyLIV", query: "SonyLIV", slug: "sonyliv", color: "AC2773" },
      { name: "ZEE5", query: "ZEE5", slug: "zee5", color: "8230AB" },
      { name: "Apple TV+", query: "Apple TV", slug: "appletv", color: "000000" },
      { name: "HBO Max", query: "HBO Max", slug: "max", color: "002BE7" },
    ],
  },
  {
    title: "Music",
    items: [
      { name: "Spotify", query: "Spotify", slug: "spotify", color: "1DB954" },
      { name: "YouTube Premium", query: "YouTube Premium", slug: "youtube", color: "FF0000" },
      { name: "Gaana", query: "Gaana", slug: "gaana", color: "E72C30" },
      { name: "JioSaavn", query: "JioSaavn", slug: "jiosaavn", color: "2BC659" },
    ],
  },
  {
    title: "AI Tools",
    items: [
      { name: "ChatGPT", query: "ChatGPT", slug: "openai", color: "412991" },
      { name: "Midjourney", query: "Midjourney", slug: "midjourney", color: "000000" },
      { name: "Leonardo AI", query: "Leonardo", slug: "leonardoai", color: "000000" },
      { name: "Grammarly", query: "Grammarly", slug: "grammarly", color: "27AE60" },
      { name: "Notion", query: "Notion", slug: "notion", color: "000000" },
    ],
  },
  {
    title: "Software & Design",
    items: [
      { name: "Microsoft 365", query: "Microsoft 365", slug: "microsoft365", color: "D83B01" },
      { name: "Adobe", query: "Adobe", slug: "adobe", color: "FF0000" },
      { name: "Canva", query: "Canva", slug: "canva", color: "00C4CC" },
      { name: "Figma", query: "Figma", slug: "figma", color: "F24E1E" },
    ],
  },
  {
    title: "Gaming",
    items: [
      { name: "Xbox Game Pass", query: "Xbox", slug: "xbox", color: "107C10" },
      { name: "PlayStation Plus", query: "PlayStation", slug: "playstation", color: "003791" },
    ],
  },
  {
    title: "VPN",
    items: [
      { name: "NordVPN", query: "NordVPN", slug: "nordvpn", color: "4687FF" },
      { name: "ExpressVPN", query: "ExpressVPN", slug: "expressvpn", color: "DA3940" },
    ],
  },
  {
    title: "Learning",
    items: [
      { name: "Coursera", query: "Coursera", slug: "coursera", color: "0056D2" },
      { name: "Udemy", query: "Udemy", slug: "udemy", color: "A435F0" },
    ],
  },
];

const logoUrl = (slug: string, color: string) =>
  `https://cdn.simpleicons.org/${slug}/${color}`;

const LogoCard = ({ p }: { p: Platform }) => (
  <Link
    to={`/browse?q=${encodeURIComponent(p.query)}`}
    className="group relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/15 hover:border-primary/40 min-w-[120px]"
    aria-label={`Browse ${p.name}`}
  >
    <div className="h-12 w-12 grid place-items-center">
      <img
        src={logoUrl(p.slug, p.color)}
        alt={`${p.name} logo`}
        loading="lazy"
        decoding="async"
        width={48}
        height={48}
        className="max-h-12 max-w-12 object-contain transition-transform duration-300 group-hover:scale-110"
        onError={(e) => {
          // Hide broken icon, show first letter fallback
          const t = e.currentTarget;
          t.style.display = "none";
          const fb = t.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = "grid";
        }}
      />
      <span
        style={{ display: "none" }}
        className="h-12 w-12 rounded-xl bg-primary/10 text-primary place-items-center font-bold"
      >
        {p.name[0]}
      </span>
    </div>
    <div className="text-xs font-medium text-foreground/80 text-center leading-tight">
      {p.name}
    </div>
  </Link>
);

export const PopularPlatforms = () => {
  return (
    <section className="container py-16 md:py-20">
      <div className="text-center mb-10 md:mb-12">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full mb-3">
          Trusted brands
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Explore Popular Platforms
        </h2>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          All your favourite subscriptions in one place — from streaming and music to AI, software, gaming and learning.
        </p>
      </div>

      <div className="space-y-10">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
              {g.title}
            </h3>

            {/* Mobile: horizontal scroll */}
            <div className="md:hidden -mx-4 px-4 overflow-x-auto no-scrollbar">
              <div className="flex gap-3 pb-2">
                {g.items.map((p) => (
                  <div key={p.name} className="flex-shrink-0 w-[120px]">
                    <LogoCard p={p} />
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: responsive grid */}
            <div className="hidden md:grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {g.items.map((p) => (
                <LogoCard key={p.name} p={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
