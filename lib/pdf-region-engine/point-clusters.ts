import type { Rect } from "./base-types";
export function clusterPoints(
  regions: Rect[],
  aspect: number,
  distance: number,
  minPoints: number,
) {
  const width = 1200,
    height = width * aspect;
  const points = regions.map((r, i) => ({
    id: i,
    x: (r.x + r.w / 2) * width,
    y: (r.y + r.h / 2) * height,
    rect: r,
  }));
  const parents = points.map((_, i) => i),
    size = points.map(() => 1),
    grid = new Map<string, number[]>();
  function root(i: number): number {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  }
  function join(a: number, b: number) {
    a = root(a);
    b = root(b);
    if (a === b) return;
    if (size[a] < size[b]) [a, b] = [b, a];
    parents[b] = a;
    size[a] += size[b];
  }
  for (const p of points) {
    const gx = Math.floor(p.x / distance),
      gy = Math.floor(p.y / distance);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const j of grid.get(`${gx + dx}:${gy + dy}`) ?? []) {
          const q = points[j];
          if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= distance ** 2)
            join(p.id, j);
        }
    const k = `${gx}:${gy}`;
    const cell = grid.get(k) ?? [];
    cell.push(p.id);
    grid.set(k, cell);
  }
  const members = new Map<number, number[]>();
  for (const p of points) {
    const k = root(p.id),
      list = members.get(k) ?? [];
    list.push(p.id);
    members.set(k, list);
  }
  const clusters = [...members.values()]
    .filter((ids) => ids.length >= minPoints)
    .map((ids, i) => {
      const rs = ids.map((id) => regions[id]),
        x = Math.min(...rs.map((r) => r.x)),
        y = Math.min(...rs.map((r) => r.y));
      return {
        id: i,
        pointIds: ids,
        rect: {
          x,
          y,
          w: Math.max(...rs.map((r) => r.x + r.w)) - x,
          h: Math.max(...rs.map((r) => r.y + r.h)) - y,
        },
      };
    });
  const labels = new Map<number, number>();
  clusters.forEach((c) => c.pointIds.forEach((id) => labels.set(id, c.id)));
  return {
    width,
    height,
    points: points.map((p) => ({ ...p, cluster: labels.get(p.id) ?? -1 })),
    clusters,
    unclustered: points.filter((p) => !labels.has(p.id)).length,
  };
}
