import { distanceKm, chargeForDistance, type DeliverySlab } from "@/lib/mannu";

type AnySupabase = {
  from: (table: string) => any;
};

export type QuoteItem = { productId: string; qty: number; variantId?: string | null };

export type OrderQuote = {
  subtotal: number;
  deliveryCharge: number;
  platformFee: number;
  discount: number;
  couponCode: string | null;
  total: number;
  totalKm: number;
  isMulti: boolean;
  earning: number;
  freeAbove: number;
  itemRows: Array<Record<string, unknown>>;
  address: {
    id: string;
    latitude: number;
    longitude: number;
    house_flat_no: string;
    street_area: string;
    landmark: string | null;
  };
};

/**
 * Single source of truth for order pricing — used by both the checkout quote
 * preview and the real placeOrder handler so displayed and charged totals match.
 */
export async function computeOrderQuote(
  supabase: AnySupabase,
  args: { userId: string; addressId: string; items: QuoteItem[]; couponCode?: string | undefined },
): Promise<OrderQuote> {
  const { data: address, error: addrErr } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("id", args.addressId)
    .eq("customer_id", args.userId)
    .maybeSingle();
  if (addrErr || !address) throw new Error("Delivery address not found");

  const ids = args.items.map((i) => i.productId);
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(
      "id,product_name,price,stock_qty,is_available,store_id,unit_qty,units(short_name),stores(id,store_name,latitude,longitude,is_active)",
    )
    .in("id", ids);
  if (prodErr || !products?.length) throw new Error("Products unavailable");

  const variantIds = args.items.map((i) => i.variantId).filter(Boolean) as string[];
  let variants: any[] = [];
  if (variantIds.length) {
    const { data: vRows } = await supabase
      .from("product_variants")
      .select("id,product_id,label,price,stock_qty,is_available,unit_qty,units(short_name)")
      .in("id", variantIds);
    variants = vRows ?? [];
  }

  const storeIds = [...new Set(products.map((p: any) => p.store_id as string))];
  if (storeIds.length > 2) throw new Error("An order can include at most 2 stores");

  const { data: settingsRows } = await supabase.from("system_settings").select("key,value");
  const settings = Object.fromEntries(
    ((settingsRows ?? []) as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
  ) as Record<string, unknown>;
  const slabs = (settings["delivery_slabs"] as DeliverySlab[] | undefined) ?? [
    { max_km: 3, charge: 20 },
  ];
  const platformFee = Number((settings["platform_fee"] as { amount?: number })?.amount ?? 0);
  const basePay = Number((settings["delivery_base_pay"] as { amount?: number })?.amount ?? 30);
  const bonus = Number((settings["multi_pickup_bonus"] as { amount?: number })?.amount ?? 25);
  const maxRadius = Number((settings["max_batch_radius_km"] as { value?: number })?.value ?? 12);
  const freeAbove = Number((settings["free_delivery_above"] as { amount?: number })?.amount ?? 1e9);
  const surge = settings["surge"] as { active?: boolean; multiplier?: number } | undefined;

  let subtotal = 0;
  const itemRows: Array<Record<string, unknown>> = [];
  for (const line of args.items) {
    const p = products.find((x: any) => x.id === line.productId);
    if (!p) throw new Error("A product in your cart is no longer available");
    const v = line.variantId
      ? variants.find((x: any) => x.id === line.variantId && x.product_id === p.id)
      : null;
    if (line.variantId && !v) throw new Error(`${p.product_name}: selected size is no longer available`);

    const available = v ? v.is_available : p.is_available;
    const stock = Number(v ? v.stock_qty : p.stock_qty);
    const displayName = v ? `${p.product_name} (${v.label})` : p.product_name;
    if (!p.is_available || !available || stock < line.qty)
      throw new Error(`${displayName} is out of stock`);

    const unitPrice = Number(v ? v.price : p.price);
    const unitSource = v ?? p;
    const lineTotal = unitPrice * line.qty;
    subtotal += lineTotal;
    itemRows.push({
      store_id: p.store_id,
      product_id: p.id,
      product_name: displayName,
      unit_label: v
        ? v.label
        : `${unitSource.unit_qty} ${(unitSource.units as { short_name?: string } | null)?.short_name ?? ""}`.trim(),
      unit_price: unitPrice,
      qty: line.qty,
      line_total: lineTotal,
    });
  }

  let totalKm = 0;
  for (const sid of storeIds) {
    const store = products.find((p: any) => p.store_id === sid)?.stores as
      | { latitude: number; longitude: number }
      | null;
    if (!store) continue;
    const km = distanceKm(store.latitude, store.longitude, address.latitude, address.longitude);
    if (km > maxRadius) throw new Error("A store in your cart is outside the 12 km service area");
    totalKm = Math.max(totalKm, km);
  }

  const isMulti = storeIds.length > 1;
  let deliveryCharge = chargeForDistance(slabs, totalKm);
  if (surge?.active) deliveryCharge = Math.round(deliveryCharge * (surge.multiplier ?? 1));
  if (isMulti) deliveryCharge += 15;
  if (subtotal >= freeAbove) deliveryCharge = 0;

  let discount = 0;
  let couponCode: string | null = null;
  if (args.couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", args.couponCode.toUpperCase())
      .eq("is_active", true)
      .maybeSingle();
    if (coupon && subtotal >= Number(coupon.min_order)) {
      discount =
        coupon.discount_type === "PERCENT"
          ? Math.min(
              (subtotal * Number(coupon.discount_value)) / 100,
              Number(coupon.max_discount ?? Infinity),
            )
          : Number(coupon.discount_value);
      discount = Math.round(discount);
      couponCode = coupon.code;
    }
  }

  const total = Math.max(0, subtotal + deliveryCharge + platformFee - discount);
  const earning = basePay + (isMulti ? bonus : 0) + Math.round(totalKm * 4);

  return {
    subtotal,
    deliveryCharge,
    platformFee,
    discount,
    couponCode,
    total,
    totalKm,
    isMulti,
    earning,
    freeAbove,
    itemRows,
    address,
  };
}
