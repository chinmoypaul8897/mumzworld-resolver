import { mockOrders } from "./mock-orders";
import type { Order } from "../schemas/order";

/**
 * Lightweight summary of a mock order, for the order picker dropdown.
 * Keeps the page bundle small (no full order details) and gives the
 * picker label the shape: "M44781 — Pampers Size 3 (Sharjah, UAE)".
 */
export interface OrderSummary {
  order_id: string;
  label: string;
  status: Order["status"];
  is_priority: boolean;
}

function buildSummary(order: Order): OrderSummary {
  const firstItem = order.items[0]?.name ?? "(no items)";
  const shortName = firstItem.length > 40 ? firstItem.slice(0, 37) + "…" : firstItem;
  return {
    order_id: order.order_id,
    label: `${order.order_id} — ${shortName} (${order.customer.location})`,
    status: order.status,
    is_priority: order.is_priority,
  };
}

export const ORDER_SUMMARIES: OrderSummary[] = mockOrders.map(buildSummary);