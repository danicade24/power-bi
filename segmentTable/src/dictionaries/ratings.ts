export const RATINGS_MAP: Record<string, number> = {
    "AAA": 1,
    "AA+": 2,
    "AA": 3,
    "AA-": 4,
    "A+": 5,
    "A": 6,
    "A-": 7,
    "BBB+": 8,
    "BBB": 9,
    "BBB-": 10,
    "BB+": 11,
    "BB": 12,
    "BB-": 13,
    "B+": 14,
    "B": 15,
    "B-": 16,
    "CCC+": 17,
    "CCC": 18,
    "CCC-": 19,
    "CC": 20,
    "C": 21,
    "D": 22,
    "SD": 23,
    "NR": 24
};

// export function mapRatingToNumber(text: string): number | null {
//     const key = text.trim().toUpperCase();
//     return key in RATINGS_MAP ? RATINGS_MAP[key] : null;
// }