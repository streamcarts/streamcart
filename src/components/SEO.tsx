import { Helmet } from "react-helmet-async";

const SITE_URL = "https://streamcart.lovable.app";
const SITE_NAME = "StreamCart";
const DEFAULT_DESC =
  "Get Netflix, ChatGPT, Spotify and 100+ premium subscriptions at lowest prices in India. Instant delivery, verified sellers, money-back guarantee.";
const DEFAULT_IMG = `${SITE_URL}/og-cover.jpg`;

type SEOProps = {
  title?: string;
  description?: string;
  path?: string; // e.g. "/p/netflix-premium"
  image?: string;
  noindex?: boolean;
  type?: "website" | "product" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export const SEO = ({ title, description, path, image, noindex, type = "website", jsonLd }: SEOProps) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Premium Subscriptions at Lowest Prices in India`;
  const desc = description ?? DEFAULT_DESC;
  const url = `${SITE_URL}${path ?? ""}`;
  const img = image ?? DEFAULT_IMG;

  const lds = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />

      {lds.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;
