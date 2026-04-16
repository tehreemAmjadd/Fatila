export function calculateLeadScore(lead: any) {
  let score = 0;

  // ✅ Basic Info
  if (lead.email) score += 10;
  if (lead.phone) score += 10;
  if (lead.company) score += 10;

  // ✅ Behavior (future use, abhi dummy chalega)
  if (lead.visitedPricingPage) score += 15;
  if (lead.visits > 1) score += 10;

  // ✅ Business Value
  if (lead.companySize > 50) score += 20;
  if (["US", "UK", "Canada"].includes(lead.country)) score += 15;

  if (lead.email && !lead.email.includes("gmail")) {
    score += 10;
  }

  return score;
}
export function getLeadPriority(score: number) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}