// dictionaries/index.ts
export const VALUE_MAP: Record<string, number> = {
    // BICRA / Factors
    "very strong (+2 notches)":      5,
    "strong/adequate (no impact)":   4,
    "adequate (no impact)":          4,
    "constrained (-1 notch)":        2,
    "0":                             0,

    // Scores
    "vulnerable": 1,
    "very high risk": 1,
    "significant": 3,
    "satisfactory": 4,

    // Infrastructure
    "significant risk": 5,
    "adequate risk": 10,
    "low risk": 13,
    "delinked": 5,
    "very low": 5,
};

export function mapCategoryToNumber(text: string): number | null {
    const key = text.trim().toLowerCase();
    return key in VALUE_MAP ? VALUE_MAP[key] : null;
}