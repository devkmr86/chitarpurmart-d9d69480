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
    .array(z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullish(),
        qty: z.number().min(1).max(50),
      }))
    .min(1)
    .max(40),
});

const quoteInput = z.object({
  addressId: z.string().uuid(),
  couponCode: z.string().trim().max(24).optional(),
  items: z
    .array(z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullish(),
        qty: z.number().min(1).max(50),
      }))
    .min(1)
    .max(40),
});

/** Read-only price breakdown for the checkout bill summary (same math as placeOrder). */
export const quoteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => quoteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { computeOrderQuote } = await import("@/lib/pricing.server");
    const q = await computeOrderQuote(context.supabase, {
      userId: context.userId,
      addressId: data.addressId,
      items: data.items,
      couponCode: data.couponCode,
    });
    return {
      subtotal: q.subtotal,
      deliveryCharge: q.deliveryCharge,
      platformFee: q.platformFee,
      discount: q.discount,
      couponCode: q.couponCode,
      total: q.total,
      distanceKm: q.totalKm,
      isMulti: q.isMulti,
      freeAbove: q.freeAbove,
    };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => placeOrderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { computeOrderQuote } = await import("@/lib/pricing.server");
    const q = await computeOrderQuote(supabase, {
      userId,
      addressId: data.addressId,
      items: data.items,
      couponCode: data.couponCode,
    });

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        address_id: q.address.id,
        subtotal: q.subtotal,
        delivery_charge: q.deliveryCharge,
        platform_fee: q.platformFee,
        discount: q.discount,
        total: q.total,
        coupon_code: q.couponCode,
        payment_mode: data.paymentMode,
        distance_km: q.totalKm,
        is_multi_pickup: q.isMulti,
        delivery_earning: q.earning,
        recipient_name: data.recipientName ?? null,
        recipient_phone: data.recipientPhone ?? null,
        delivery_address: [q.address.house_flat_no, q.address.street_area, q.address.landmark]
          .filter(Boolean)
          .join(", "),
        delivery_lat: q.address.latitude,
        delivery_lng: q.address.longitude,
      })
      .select("id,order_no,total,otp")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Could not place order");

    const { error: itemErr } = await supabase
      .from("order_items")
      .insert(q.itemRows.map((r) => ({ ...r, order_id: order.id })) as never);
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

    // --- Nightly settlement ledgers -------------------------------------
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const earning = Number(order.delivery_earning);

    const { data: rider } = await supabaseAdmin
      .from("driver_earnings")
      .select("unsettled_balance,lifetime_earned")
      .eq("user_id", userId)
      .maybeSingle();
    await supabaseAdmin.from("driver_earnings").upsert(
      {
        user_id: userId,
        unsettled_balance: Number(rider?.unsettled_balance ?? 0) + earning,
        lifetime_earned: Number(rider?.lifetime_earned ?? 0) + earning,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    const { data: settings } = await supabaseAdmin
      .from("business_settings")
      .select("commission_pct")
      .limit(1)
      .maybeSingle();
    const { data: lines } = await supabaseAdmin
      .from("order_items")
      .select("store_id,line_total,stores(commission_pct)")
      .eq("order_id", order.id);

    const byStore = new Map<string, { gross: number; pct: number }>();
    for (const l of lines ?? []) {
      const pct = Number(
        (l.stores as { commission_pct?: number | null } | null)?.commission_pct ??
          settings?.commission_pct ??
          10,
      );
      const cur = byStore.get(l.store_id) ?? { gross: 0, pct };
      cur.gross += Number(l.line_total);
      byStore.set(l.store_id, cur);
    }
    for (const [storeId, agg] of byStore) {
      const net = Math.round((agg.gross - (agg.gross * agg.pct) / 100) * 100) / 100;
      const { data: sw } = await supabaseAdmin
        .from("seller_wallets")
        .select("unsettled_balance,lifetime_earned")
        .eq("store_id", storeId)
        .maybeSingle();
      await supabaseAdmin.from("seller_wallets").upsert(
        {
          store_id: storeId,
          unsettled_balance: Number(sw?.unsettled_balance ?? 0) + net,
          lifetime_earned: Number(sw?.lifetime_earned ?? 0) + net,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" },
      );
    }

    return { ok: true };
  });

/** Admin: marks a seller/rider as settled tonight and clears their unsettled balance. */
export const markSettled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        payeeType: z.enum(["SELLER", "RIDER"]),
        payeeId: z.string().uuid(),
        payeeName: z.string().trim().max(80).default(""),
        amount: z.number().min(0).max(1000000),
        ordersCount: z.number().int().min(0).default(0),
        reference: z.string().trim().max(60).optional(),
        method: z.string().trim().max(20).default("UPI"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.payeeType === "SELLER") {
      await supabaseAdmin
        .from("seller_wallets")
        .update({ unsettled_balance: 0, updated_at: new Date().toISOString() })
        .eq("store_id", data.payeeId);
    } else {
      await supabaseAdmin
        .from("driver_earnings")
        .update({ unsettled_balance: 0, updated_at: new Date().toISOString() })
        .eq("user_id", data.payeeId);
    }

    await supabaseAdmin.from("settlement_history").insert({
      payee_type: data.payeeType,
      payee_id: data.payeeId,
      payee_name: data.payeeName,
      amount: data.amount,
      orders_count: data.ordersCount,
      method: data.method,
      reference: data.reference ?? null,
      settled_by: userId,
    });

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
