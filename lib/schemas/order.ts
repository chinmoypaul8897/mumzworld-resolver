import { z } from "zod";

/**
 * The 6 product categories that drive policy lookup.
 * The classifier maps an item to one of these.
 * The policy table is keyed by (issue_type × product_category).
 */
export const ProductCategorySchema = z.enum([
  "infant_consumables",      // formula, baby food, milk, diapers, wipes
  "infant_safety_critical",  // car seats, cribs, strollers, baby gates, monitors
  "infant_clothing",         // onesies, sleepsuits, baby clothes
  "infant_gear_general",     // feeding gear, bath gear, toys
  "mom_essentials",          // maternity, breast pumps, postpartum
  "gift_or_registry",        // purchases via registry feature
]);

export type ProductCategory = z.infer<typeof ProductCategorySchema>;

/**
 * Order lifecycle status. Drives what actions are available.
 * - pending: ordered, not yet shipped
 * - shipped: in transit
 * - delivered: arrived
 * - cancelled: cancelled by mom or by mumzworld
 * - returned: mom initiated and completed return
 */
export const OrderStatusSchema = z.enum([
  "pending",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/**
 * A single line item in an order.
 */
export const OrderItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  category: ProductCategorySchema,
  quantity: z.number().int().positive(),
  price_aed: z.number().positive(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

/**
 * Customer identity and preferences.
 * language_pref of "auto" means: use the language she actually types in.
 */
export const CustomerSchema = z.object({
  name: z.string().min(1),
  language_pref: z.enum(["en", "ar", "auto"]),
  location: z.string().min(1),  // e.g., "Riyadh, KSA" or "Dubai Marina, UAE"
});

export type Customer = z.infer<typeof CustomerSchema>;

/**
 * The full order object. This is what the classifier and response
 * generator see as context when mom complains.
 *
 * Dates are ISO 8601 strings (e.g., "2026-04-25T18:30:00+04:00").
 * We use strings, not Date objects, because the LLM sees strings
 * and we want eval reproducibility.
 */
export const OrderSchema = z.object({
  order_id: z.string().min(1),
  customer: CustomerSchema,
  items: z.array(OrderItemSchema).min(1),
  status: OrderStatusSchema,
  ordered_at: z.string(),
  promised_delivery: z.string(),
  actual_delivery: z.string().nullable(),  // null = not yet delivered
  shipping_fee_aed: z.number().nonnegative(),
  is_priority: z.boolean(),
});

export type Order = z.infer<typeof OrderSchema>;