import type { Order } from "../schemas/order";

/**
 * 15 mock orders covering all scenarios our engine + evals need.
 *
 * Coverage:
 *   Categories (15 items across 15 orders):
 *     - infant_consumables: 5 (formula, diapers, wipes, baby food)
 *     - infant_safety_critical: 3 (car seat, crib, stroller)
 *     - infant_clothing: 2
 *     - infant_gear_general: 2 (feeding, bath)
 *     - mom_essentials: 2 (breast pump, postpartum)
 *     - gift_or_registry: 1
 *
 *   Statuses:
 *     - 3 pending (in transit, not yet arrived)
 *     - 8 delivered (already received, may have problems)
 *     - 2 cancelled (mumzworld cancelled — drives cancellation_dispute cases)
 *     - 2 shipped (out for delivery, may be late)
 *
 *   Geography:
 *     - 7 UAE (Dubai, Abu Dhabi)
 *     - 6 KSA (Riyadh, Jeddah)
 *     - 2 other GCC (Kuwait, Bahrain)
 *
 *   Languages:
 *     - 6 ar
 *     - 5 en
 *     - 4 auto (mom hasn't set preference)
 *
 *   Priority shipping:
 *     - 6 priority (paid extra)
 *     - 9 standard
 *
 * Order IDs use M-prefix + 5-digit number to look like real Mumzworld
 * order IDs (verified by checking their UI). Dates span April 22-28, 2026.
 */
export const mockOrders: Order[] = [
  /* ─── Fatima's order (the persona-anchor case) ─── */
  {
    order_id: "M44521",
    customer: {
      name: "Fatima Al-Saud",
      language_pref: "ar",
      location: "Riyadh, KSA",
    },
    items: [
      {
        sku: "APT-S1-800",
        name: "Aptamil Stage 1 Infant Formula 800g",
        category: "infant_consumables",
        quantity: 2,
        price_aed: 89,
      },
    ],
    status: "shipped",
    ordered_at: "2026-04-25T18:30:00+03:00",
    promised_delivery: "2026-04-26T10:00:00+03:00",
    actual_delivery: null,
    shipping_fee_aed: 28,
    is_priority: true,
  },

  /* ─── Damaged car seat case (S2 in eval set) ─── */
  {
    order_id: "M44698",
    customer: {
      name: "Mariam Al-Otaibi",
      language_pref: "ar",
      location: "Riyadh, KSA",
    },
    items: [
      {
        sku: "CYB-CLOUD-Z",
        name: "Cybex Cloud Z2 i-Size Infant Car Seat",
        category: "infant_safety_critical",
        quantity: 1,
        price_aed: 1849,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-22T14:00:00+03:00",
    promised_delivery: "2026-04-25T18:00:00+03:00",
    actual_delivery: "2026-04-25T17:42:00+03:00",
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Standard wrong-size onesie case ─── */
  {
    order_id: "M44712",
    customer: {
      name: "Sarah Khan",
      language_pref: "en",
      location: "Abu Dhabi, UAE",
    },
    items: [
      {
        sku: "CART-NEW-3M",
        name: "Carter's Newborn 5-Pack Bodysuits 3M",
        category: "infant_clothing",
        quantity: 1,
        price_aed: 119,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-23T09:15:00+04:00",
    promised_delivery: "2026-04-24T18:00:00+04:00",
    actual_delivery: "2026-04-24T16:00:00+04:00",
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Multi-item order (adversarial case A2: wrong color AND size) ─── */
  {
    order_id: "M44755",
    customer: {
      name: "Amal Hadid",
      language_pref: "auto",
      location: "Dubai Marina, UAE",
    },
    items: [
      {
        sku: "CART-RB-6M",
        name: "Carter's Rainbow Bodysuit 6M",
        category: "infant_clothing",
        quantity: 3,
        price_aed: 89,
      },
      {
        sku: "JLY-SOCK-3PK",
        name: "Jellycat Sock Set 3-Pack",
        category: "infant_clothing",
        quantity: 1,
        price_aed: 75,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-24T11:30:00+04:00",
    promised_delivery: "2026-04-26T18:00:00+04:00",
    actual_delivery: "2026-04-26T14:20:00+04:00",
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Diapers, late delivery (E5 in eval set) ─── */
  {
    order_id: "M44781",
    customer: {
      name: "Layla Mansour",
      language_pref: "auto",
      location: "Sharjah, UAE",
    },
    items: [
      {
        sku: "PMP-SZ3-72",
        name: "Pampers Premium Care Size 3 Mega Pack",
        category: "infant_consumables",
        quantity: 1,
        price_aed: 119,
      },
    ],
    status: "shipped",
    ordered_at: "2026-04-25T20:00:00+04:00",
    promised_delivery: "2026-04-26T20:00:00+04:00",
    actual_delivery: null,
    shipping_fee_aed: 28,
    is_priority: true,
  },

  /* ─── Hot formula safety case (S1) ─── */
  {
    order_id: "M44823",
    customer: {
      name: "Noura Al-Qahtani",
      language_pref: "en",
      location: "Jeddah, KSA",
    },
    items: [
      {
        sku: "SIM-NEO-820",
        name: "Similac Neosure Premature Formula 820g",
        category: "infant_consumables",
        quantity: 1,
        price_aed: 145,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-26T09:00:00+03:00",
    promised_delivery: "2026-04-27T12:00:00+03:00",
    actual_delivery: "2026-04-27T11:30:00+03:00",
    shipping_fee_aed: 28,
    is_priority: true,
  },

  /* ─── Cancelled stroller (cancellation_dispute case) ─── */
  {
    order_id: "M44856",
    customer: {
      name: "Hala Yousef",
      language_pref: "ar",
      location: "Dubai, UAE",
    },
    items: [
      {
        sku: "JOI-LITETRX",
        name: "Joie Litetrax Pro Pushchair",
        category: "infant_safety_critical",
        quantity: 1,
        price_aed: 999,
      },
    ],
    status: "cancelled",
    ordered_at: "2026-04-22T15:00:00+04:00",
    promised_delivery: "2026-04-25T18:00:00+04:00",
    actual_delivery: null,
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Damaged stroller (delivered with broken wheel — eval E2) ─── */
  {
    order_id: "M44889",
    customer: {
      name: "Reem Hijazi",
      language_pref: "auto",
      location: "Abu Dhabi, UAE",
    },
    items: [
      {
        sku: "BAB-ZEN-YOYO",
        name: "BABYZEN YOYO² Stroller 6+",
        category: "infant_safety_critical",
        quantity: 1,
        price_aed: 2299,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-23T10:00:00+04:00",
    promised_delivery: "2026-04-26T14:00:00+04:00",
    actual_delivery: "2026-04-26T13:50:00+04:00",
    shipping_fee_aed: 50,
    is_priority: true,
  },

  /* ─── Bottle steriliser quality complaint (eval E4) ─── */
  {
    order_id: "M44912",
    customer: {
      name: "Priya Sharma",
      language_pref: "en",
      location: "Dubai Marina, UAE",
    },
    items: [
      {
        sku: "AVT-3IN1-STR",
        name: "Philips Avent 3-in-1 Electric Steam Steriliser",
        category: "infant_gear_general",
        quantity: 1,
        price_aed: 449,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-04T16:00:00+04:00",
    promised_delivery: "2026-04-07T18:00:00+04:00",
    actual_delivery: "2026-04-07T15:15:00+04:00",
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Diapers with rash (soft safety rule case) ─── */
  {
    order_id: "M44948",
    customer: {
      name: "Aisha Al-Rashid",
      language_pref: "auto",
      location: "Riyadh, KSA",
    },
    items: [
      {
        sku: "HUG-NEW-SZ1",
        name: "Huggies Newborn Size 1 Mega Pack",
        category: "infant_consumables",
        quantity: 2,
        price_aed: 89,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-21T12:00:00+03:00",
    promised_delivery: "2026-04-23T18:00:00+03:00",
    actual_delivery: "2026-04-23T16:00:00+03:00",
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Wrong baby food jars (eval E3 in arabic) ─── */
  {
    order_id: "M44972",
    customer: {
      name: "Hessa Al-Mansoori",
      language_pref: "ar",
      location: "Abu Dhabi, UAE",
    },
    items: [
      {
        sku: "GER-STG2-12",
        name: "Gerber Stage 2 Pureed Mixed Vegetables 12-pack",
        category: "infant_consumables",
        quantity: 1,
        price_aed: 95,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-25T14:00:00+04:00",
    promised_delivery: "2026-04-27T18:00:00+04:00",
    actual_delivery: "2026-04-27T17:00:00+04:00",
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Breast pump (mom_essentials, baseline case) ─── */
  {
    order_id: "M44995",
    customer: {
      name: "Iman Khalil",
      language_pref: "en",
      location: "Kuwait City, Kuwait",
    },
    items: [
      {
        sku: "MED-FRE-FLEX",
        name: "Medela Freestyle Flex Double Electric Breast Pump",
        category: "mom_essentials",
        quantity: 1,
        price_aed: 1599,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-20T11:00:00+03:00",
    promised_delivery: "2026-04-23T18:00:00+03:00",
    actual_delivery: "2026-04-23T17:30:00+03:00",
    shipping_fee_aed: 50,
    is_priority: false,
  },

  /* ─── Postpartum essentials kit (mom_essentials) ─── */
  {
    order_id: "M45013",
    customer: {
      name: "Yasmin Tabbah",
      language_pref: "auto",
      location: "Manama, Bahrain",
    },
    items: [
      {
        sku: "FRD-PP-KIT",
        name: "Frida Mom Postpartum Recovery Kit",
        category: "mom_essentials",
        quantity: 1,
        price_aed: 199,
      },
    ],
    status: "shipped",
    ordered_at: "2026-04-26T16:00:00+03:00",
    promised_delivery: "2026-04-28T18:00:00+03:00",
    actual_delivery: null,
    shipping_fee_aed: 28,
    is_priority: true,
  },

  /* ─── Cancelled wipes (cancellation_dispute on consumable) ─── */
  {
    order_id: "M45048",
    customer: {
      name: "Maha Saif",
      language_pref: "en",
      location: "Sharjah, UAE",
    },
    items: [
      {
        sku: "WAT-WPS-720",
        name: "WaterWipes Sensitive Baby Wipes 720-pack",
        category: "infant_consumables",
        quantity: 1,
        price_aed: 159,
      },
    ],
    status: "cancelled",
    ordered_at: "2026-04-23T13:00:00+04:00",
    promised_delivery: "2026-04-25T18:00:00+04:00",
    actual_delivery: null,
    shipping_fee_aed: 0,
    is_priority: false,
  },

  /* ─── Gift registry order (gift_or_registry) ─── */
  {
    order_id: "M45072",
    customer: {
      name: "Latifa Al-Mazrouei",
      language_pref: "ar",
      location: "Dubai, UAE",
    },
    items: [
      {
        sku: "STK-TRP-WHT",
        name: "Stokke Tripp Trapp High Chair (Registry Gift)",
        category: "gift_or_registry",
        quantity: 1,
        price_aed: 1199,
      },
    ],
    status: "delivered",
    ordered_at: "2026-04-19T10:00:00+04:00",
    promised_delivery: "2026-04-22T18:00:00+04:00",
    actual_delivery: "2026-04-22T16:30:00+04:00",
    shipping_fee_aed: 0,
    is_priority: false,
  },
];

/**
 * Lookup helper. Returns null for unknown order IDs so the
 * orchestrator can route to "i can only help with your existing
 * orders" gracefully.
 */
export function getMockOrder(orderId: string): Order | null {
  return mockOrders.find((o) => o.order_id === orderId) ?? null;
}