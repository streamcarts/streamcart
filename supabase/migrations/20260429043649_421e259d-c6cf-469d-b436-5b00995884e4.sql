-- Make orders.product_id deletion-safe
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;

-- credential reference on orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_credential_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_credential_id_fkey
  FOREIGN KEY (credential_id) REFERENCES public.product_credentials(id) ON DELETE SET NULL;

-- product_credentials → products: cascade delete (creds belong to product)
ALTER TABLE public.product_credentials DROP CONSTRAINT IF EXISTS product_credentials_product_id_fkey;
ALTER TABLE public.product_credentials
  ADD CONSTRAINT product_credentials_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- reviews → products: cascade (reviews belong to a product)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_product_id_fkey;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- refunds → orders: cascade so deleting an order doesn't break (rare admin op)
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_order_id_fkey;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- affiliate_conversions → orders: keep history; null out the order link if order ever deleted
ALTER TABLE public.affiliate_conversions DROP CONSTRAINT IF EXISTS affiliate_conversions_order_id_fkey;
ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.affiliate_conversions ALTER COLUMN order_id DROP NOT NULL;
