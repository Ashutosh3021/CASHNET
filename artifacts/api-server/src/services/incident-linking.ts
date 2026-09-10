/**
 * Incident Linking Service
 *
 * Automated cross-case entity linking and complaint similarity discovery.
 * Finds related cases by:
 * 1. Entity overlap — cases sharing accounts, wallets, or identifiers
 * 2. Complaint similarity — cases with similar complaint narratives or indicators
 */

export interface LinkedIncident {
  caseId: string;
  reference: string;
  sharedEntities: string[];
  similarityScore: number;
  linkType: "entity_overlap" | "complaint_similarity";
}

interface CaseLike {
  id: string;
  reference?: string;
  accounts?: Array<{ id: string; masked?: string; bank?: string }>;
  wallets?: Array<{ id: string; address?: string; chain?: string }>;
  complaint?: {
    description?: string;
    indicators?: string[];
    sourceType?: string;
  };
  amount?: number;
  fraudType?: string;
  city?: string;
}

function extractEntityIds(c: CaseLike): Set<string> {
  const ids = new Set<string>();
  for (const a of c.accounts || []) {
    if (a.id) ids.add(`account:${a.id}`);
    if (a.masked) ids.add(`masked:${a.masked}`);
  }
  for (const w of c.wallets || []) {
    if (w.id) ids.add(`wallet:${w.id}`);
    if (w.address) ids.add(`addr:${w.address.toLowerCase()}`);
  }
  return ids;
}

function extractIndicators(c: CaseLike): string[] {
  const indicators: string[] = [];
  if (c.complaint?.indicators) indicators.push(...c.complaint.indicators);
  if (c.fraudType) indicators.push(c.fraudType);
  if (c.city) indicators.push(`city:${c.city}`);
  return indicators;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find incidents linked to the target case via entity overlap or complaint similarity.
 */
export function findLinkedIncidents(
  targetCase: CaseLike,
  allCases: CaseLike[],
  options: { similarityThreshold?: number } = {}
): LinkedIncident[] {
  const threshold = options.similarityThreshold ?? 0.3;
  const targetEntities = extractEntityIds(targetCase);
  const targetIndicators = new Set(extractIndicators(targetCase));
  const results: LinkedIncident[] = [];

  for (const candidate of allCases) {
    if (candidate.id === targetCase.id) continue;

    // Entity overlap check
    const candidateEntities = extractEntityIds(candidate);
    const entityScore = jaccardSimilarity(targetEntities, candidateEntities);
    if (entityScore > 0) {
      const shared: string[] = [];
      for (const e of targetEntities) {
        if (candidateEntities.has(e)) shared.push(e);
      }
      results.push({
        caseId: candidate.id,
        reference: candidate.reference || candidate.id,
        sharedEntities: shared,
        similarityScore: Math.round(entityScore * 100) / 100,
        linkType: "entity_overlap",
      });
    }

    // Complaint similarity check (indicator-based)
    const candidateIndicators = new Set(extractIndicators(candidate));
    const indicatorScore = jaccardSimilarity(targetIndicators, candidateIndicators);
    if (indicatorScore >= threshold) {
      const shared: string[] = [];
      for (const i of targetIndicators) {
        if (candidateIndicators.has(i)) shared.push(i);
      }
      // Avoid duplicate link for same case
      const existing = results.find((r) => r.caseId === candidate.id && r.linkType === "complaint_similarity");
      if (!existing) {
        results.push({
          caseId: candidate.id,
          reference: candidate.reference || candidate.id,
          sharedEntities: shared,
          similarityScore: Math.round(indicatorScore * 100) / 100,
          linkType: "complaint_similarity",
        });
      }
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarityScore - a.similarityScore);
  return results;
}
