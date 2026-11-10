-- A product with open order reservations must remain stock-tracked until those
-- reservations are consumed or released. Keep this invariant at the database
-- boundary so direct SQL cannot make payment callbacks lose reserved stock.
-- Adding a validated check intentionally fails if legacy rows violate the rule;
-- reconcile those orders before applying this migration instead of discarding
-- reservation state automatically.
ALTER TABLE public.products
  ADD CONSTRAINT products_untracked_reservation_ck
  CHECK (stock_tracked OR stock_reserved = 0);
