import { resolve } from "./orchestrator";

async function main() {
  const cases = [
    {
      label: "EN — late diapers (M44781)",
      message: "My priority order was supposed to come yesterday and I still haven't received it. I need diapers.",
      order_id: "M44781",
    },
    {
      label: "AR — damaged stroller (M44889)",
      message: "العربة وصلت مع عجلة مكسورة، ما يمديني أستخدمها مع طفلي عمره ٣ شهور",
      order_id: "M44889",
    },
    {
      label: "Out-of-scope medical (M44823)",
      message: "Is this formula safe for my baby with reflux?",
      order_id: "M44823",
    },
  ];

  for (const c of cases) {
    console.log(`\n=== ${c.label} ===`);
    try {
      const t0 = Date.now();
      const result = await resolve({ message: c.message, order_id: c.order_id });
      const dt = Date.now() - t0;
      console.log(`OK in ${dt}ms (classifier ${result.meta.classifier_ms}ms, safety ${result.meta.safety_ms}ms, responder ${result.meta.responder_ms}ms)`);
      console.log(`  issue=${result.classification.issue_type} | category=${result.classification.product_category} | urgency=${result.classification.urgency_tier} | lang=${result.classification.language}`);
      console.log(`  policy=${result.policy ? result.policy.primary_entitlement : "null (out_of_scope/unclear)"}`);
      console.log(`  safety_alert=${result.safety.safety_alert} severity=${result.safety.severity}`);
      console.log(`  headline: ${result.resolution.headline}`);
      console.log(`  used_human_escalation=${result.resolution.meta.used_human_escalation}`);
    } catch (err) {
      console.error(`FAIL: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});