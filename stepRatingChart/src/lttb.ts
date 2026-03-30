export function lttb<T extends { x: number, y: number }>(data: T[], threshold: number): T[] {
    if (threshold >= data.length) return data;

    const sampled: T[] = [];
    let bucketSize = (data.length - 2) / (threshold - 2);
    let a = 0;
    sampled.push(data[a]);

    for (let i = 0; i < threshold - 2; i++) {
        let avgX = 0, avgY = 0;
        let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
        let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
        avgRangeEnd = Math.min(avgRangeEnd, data.length);
        let avgRangeLength = avgRangeEnd - avgRangeStart;

        for (let j = avgRangeStart; j < avgRangeEnd; j++) {
            avgX += data[j].x;
            avgY += data[j].y;
        }

        avgX /= avgRangeLength || 1;
        avgY /= avgRangeLength || 1;

        let rangeOffs = Math.floor(i * bucketSize) + 1;
        let rangeTo = Math.floor((i + 1) * bucketSize) + 1;

        let maxArea = -1;
        let nextA = rangeOffs;

        for (let j = rangeOffs; j < rangeTo; j++) {
            const area = Math.abs(
                (data[a].x - avgX) * (data[j].y - data[a].y) -
                (data[a].x - data[j].x) * (avgY - data[a].y)
            );
            if (area > maxArea) {
                maxArea = area;
                nextA = j;
            }
        }

        sampled.push(data[nextA]);
        a = nextA;
    }

    sampled.push(data[data.length - 1]);
    return sampled;
}