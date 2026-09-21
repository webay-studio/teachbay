import { renderUnits, type RenderUnit } from "./reuse";
import { ImageAsset, Settings, Snapshot } from "./types";
export type Placed = {
  item: RenderUnit;
  number: number;
  height: number;
  imageHeight: number;
  scaled: boolean;
};
export type Page = { columns: Placed[][] };
// Millimeters: A4 210×297, 16mm margins, a shared 239mm body on every page.
export function paginate(
  items: Snapshot[],
  assets: Map<string, ImageAsset>,
  settings: Settings,
): Page[] {
  const pages: Page[] = [];
  const width = (178 - (settings.columns - 1) * 10) / settings.columns;
  const max = 239;
  const gap = { small: 12, medium: 28, large: 46 }[settings.space];
  let page: Page = {
    columns: Array.from({ length: settings.columns }, () => []),
  };
  let col = 0,
    used = 0;
  const units = renderUnits(items);
  for (let i = 0; i < units.length; i++) {
    const a = assets.get(units[i].assetId);
    if (!a) continue;
    const natural = (width * a.height) / a.width;
    const writingGap = units[i].last && units[i].displayNumber > 0 ? gap : 4;
    const imageHeight = Math.min(natural, max - writingGap - 8);
    const height = imageHeight + writingGap + 8;
    if (used + height > max && used > 0) {
      col++;
      used = 0;
      if (col >= settings.columns) {
        pages.push(page);
        page = { columns: Array.from({ length: settings.columns }, () => []) };
        col = 0;
      }
    }
    page.columns[col].push({
      item: units[i],
      number: units[i].displayNumber,
      height,
      imageHeight,
      scaled: imageHeight / natural < 0.65,
    });
    used += height;
  }
  if (page.columns.some((c) => c.length)) pages.push(page);
  return pages;
}
