export const RATINGS_MAP: Record<string, number> = {
    "aaa": 1,
    "aa+": 1.5,
    "aa": 2,
    "aa-": 2.5,
    "a+": 3,
    "a": 3.5,
    "a-": 4,
    "bbb+": 4.5,
    "bbb": 5,
    "bbb-": 5.5,
    "bb+": 6,
    "bb": 6.5,
    "bb-": 7,
    "b+": 7.5,
    "b": 8,
    "b-": 8.5,
    "ccc+": 9,
    "ccc": 9.5,
    "ccc-": 10
};

export function mapNumberToRating(val: number): string | null {
    const rounded = Math.floor(val * 2) / 2;
    const entry = Object.entries(RATINGS_MAP).find(([key, mappedVal]) => mappedVal === rounded);
    return entry ? entry[0] : null;
}