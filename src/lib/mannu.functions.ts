import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { distanceKm, chargeForDistance, type DeliverySlab } from "@/lib/mannu";

const placeOrderInput = z.object({
  addressId: z.string().uuid(),
  paymentMode: z.enum(["COD", "ONLINE", "WALLET"]).default("COD"),
  couponCode: z.string().trim().max(24).optional(),
  recipientName: z.string().trim().max(60).optional(),
  recipientPhone: z.string().trim().max(15).optional(),
  items: z
    .array(z.object({ productId: z.string().uuid(), qty: z.number().min(1).max(50) }))
    .min(1)
    .max(40),
});

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => placeOrderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: address, error: addrErr } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("id", data.addressId)
      .eq("customer_id", userId)
      .maybeSingle();
    if (addrErr || !address) throw new Error("Delivery address not found");

    const ids = data.items.map((i) => i.productId);
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id,product_name,price,stock_qty,is_available,store_id,unit_qty,units(short_name),stores(id,store_name,latitude,longitude,is_active)")
      .in("id", ids);
    if (prodErr || !products?.length) throw new Error("Products unavailable");

    const storeIds = [...new Set(products.map((p) => p.store_id))];
    if (storeIds.length > 2) throw new Error("An order can include at most 2 stores");

    const { data: settingsRows } = await supabase
      .from("system_settings")
      .select("key,value");
    const settings = Object.fromEntries(
      (settingsRows ?? []).map((r) => [r.key, r.value as Record<string, unknown>]),
    );
    const slabs = (settings["delivery_slabs"] as unknown as DeliverySlab[]) ?? [
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
    for (const line of data.items) {
      const p = products.find((x) => x.id === line.productId);
      if (!p) throw new Error("A product in your cart is no longer available");
      if (!p.is_available || Number(p.stock_qty) < line.qty)
        throw new Error(`${p.product_name} is out of stock`);
      const lineTotal = Number(p.price) * line.qty;
      subtotal += lineTotal;
      itemRows.push({
        store_id: p.store_id,
        product_id: p.id,
        product_name: p.product_name,
        unit_label: `${p.unit_qty} ${(p.units as { short_name?: string } | null)?.short_name ?? ""}`.trim(),
        unit_price: Number(p.price),
        qty: line.qty,
        line_total: lineTotal,
      });
    }

    let totalKm = 0;
    for (const sid of storeIds) {
      const store = products.find((p) => p.store_id === sid)?.stores as
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
    if (data.couponCode) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", data.couponCode.toUpperCase())
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

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        address_id: address.id,
        subtotal,
        delivery_charge: deliveryCharge,
        platform_fee: platformFee,
        discount,
        total,
        coupon_code: couponCode,
        payment_mode: data.paymentMode,
        distance_km: totalKm,
        is_multi_pickup: isMulti,
        delivery_earning: earning,
        recipient_name: data.recipientName ?? null,
        recipient_phone: data.recipientPhone ?? null,
        delivery_address: [address.house_flat_no, address.street_area, address.landmark]
          .filter(Boolean)
          .join(", "),
        delivery_lat: address.latitude,
        delivery_lng: address.longitude,
      })
      .select("id,order_no,total,otp")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Could not place order");

    const { error: itemErr } = await supabase
      .from("order_items")
      .insert(
        itemRows.map((r) => ({ ...r, order_id: order.id })) as never,
      );
    if (itemErr) throw new Error(itemErr.message);

    return order;
  });

/** Debits the customer wallet for a wallet-paid order. */
export const payOrderFromWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("orders")
      .select("id,customer_id,total,payment_mode")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.customer_id !== userId) throw new Error("Order not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: paid } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id")
      .eq("order_id", order.id)
      .eq("kind", "PAYMENT")
      .maybeSingle();
    if (paid) return { ok: true };

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    const balance = Number(wallet?.balance ?? 0);
    const amount = Number(order.total);
    if (balance < amount) throw new Error("Wallet me paise kam hain");

    await supabaseAdmin
      .from("wallets")
      .upsert(
        { user_id: userId, balance: balance - amount, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      amount: -amount,
      kind: "PAYMENT",
      note: "Order payment",
      order_id: order.id,
    });
    return { ok: true };
  });

export const reviewRoleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ requestId: z.string().uuid(), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { data: req } = await supabase
      .from("role_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req) throw new Error("Request not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.approve ? "APPROVED" : "REJECTED";

    await supabaseAdmin
      .from("role_requests")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", req.id);

    if (data.approve) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: req.user_id, role: req.requested_role }, { onConflict: "user_id,role" });

      if (req.requested_role === "SELLER") {
        await supabaseAdmin.from("stores").insert({
          seller_id: req.user_id,
          store_name: req.store_name ?? "New Store",
          category_id: req.category_id,
          address_line: req.address_line ?? "",
          latitude: req.latitude ?? 23.3441,
          longitude: req.longitude ?? 85.3096,
          fssai_number: req.fssai_number,
          fssai_doc_url: req.fssai_doc_url,
          is_verified: Boolean(req.fssai_number),
        });
      }
      if (req.requested_role === "DELIVERY") {
        await supabaseAdmin
          .from("delivery_profiles")
          .upsert({ user_id: req.user_id, vehicle_number: req.vehicle_number }, { onConflict: "user_id" });
      }
    }
    return { ok: true, status };
  });

export const reviewRelocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ requestId: z.string().uuid(), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { data: req } = await supabase
      .from("store_relocation_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req) throw new Error("Request not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("store_relocation_requests")
      .update({ status: data.approve ? "APPROVED" : "REJECTED" })
      .eq("id", req.id);

    if (data.approve) {
      await supabaseAdmin
        .from("stores")
        .update({
          address_line: req.new_address,
          latitude: req.new_lat,
          longitude: req.new_lng,
        })
        .eq("id", req.store_id);
    }
    return { ok: true };
  });

export const completeDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orderId: z.string().uuid(), otp: z.string().length(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("orders")
      .select("id,otp,delivery_boy_id,delivery_earning,total,payment_mode,status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.delivery_boy_id !== userId) throw new Error("Order not assigned to you");
    if (order.status === "DELIVERED") return { ok: true };
    if (order.otp !== data.otp) throw new Error("Incorrect OTP");

    await supabase
      .from("orders")
      .update({ status: "DELIVERED", delivered_at: new Date().toISOString() })
      .eq("id", order.id);

    const { data: dp } = await supabase
      .from("delivery_profiles")
      .select("cash_in_hand,total_earnings")
      .eq("user_id", userId)
      .maybeSingle();
    await supabase.from("delivery_profiles").upsert(
      {
        user_id: userId,
        total_earnings: Number(dp?.total_earnings ?? 0) + Number(order.delivery_earning),
        cash_in_hand:
          Number(dp?.cash_in_hand ?? 0) +
          (order.payment_mode === "COD" ? Number(order.total) : 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return { ok: true };
  });

/** Credits a customer's wallet and cancels the order (admin only). */
export const refundToWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        amount: z.number().positive().max(100000).optional(),
        note: z.string().trim().max(200).optional(),
        cancelOrder: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { data: order } = await supabase
      .from("orders")
      .select("id,customer_id,total,status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const amount = Math.round((data.amount ?? Number(order.total)) * 100) / 100;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", order.customer_id)
      .maybeSingle();

    await supabaseAdmin.from("wallets").upsert(
      {
        user_id: order.customer_id,
        balance: Number(wallet?.balance ?? 0) + amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: order.customer_id,
      amount,
      kind: "REFUND",
      note: data.note ?? "Order refund",
      order_id: order.id,
    });
    if (data.cancelOrder && order.status !== "CANCELLED") {
      await supabaseAdmin.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);
    }
    return { ok: true, amount };
  });

/** Seller requests a payout of their pending balance. */
export const requestStorePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id,seller_id,commission_pct")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!store || store.seller_id !== userId) throw new Error("Not your store");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("commission_pct,min_payout_limit")
      .limit(1)
      .maybeSingle();

    const commissionPct = Number(store.commission_pct ?? settings?.commission_pct ?? 10);
    const minLimit = Number(settings?.min_payout_limit ?? 200);

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("line_total, orders(status)")
      .eq("store_id", store.id);
    const delivered = (items ?? []).filter(
      (i) => (i.orders as { status?: string } | null)?.status === "DELIVERED",
    );
    const gross = delivered.reduce((s, i) => s + Number(i.line_total), 0);

    const { data: paid } = await supabaseAdmin
      .from("store_payouts")
      .select("amount")
      .eq("store_id", store.id)
      .neq("status", "REJECTED");
    const alreadyRequested = (paid ?? []).reduce((s, p) => s + Number(p.amount), 0);

    const commission = Math.round((gross * commissionPct) / 100);
    const net = Math.round(gross - commission - alreadyRequested);
    if (net < minLimit)
      throw new Error(`Minimum payout ₹${minLimit} chahiye. Abhi balance ₹${Math.max(0, net)} hai.`);

    await supabaseAdmin.from("store_payouts").insert({
      store_id: store.id,
      amount: net,
      commission_amount: commission,
      status: "PENDING",
    });
    return { ok: true, amount: net };
  });
