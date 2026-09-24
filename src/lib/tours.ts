// Tour definitions as data. Steps navigate first, then target an element
// marked with data-tour. Missing targets fall back to a centered card.

export interface TourStep {
  route: string;
  selector: string;
  titleKey: string;
  bodyKey: string;
}

export interface TourDef {
  id: string;
  steps: TourStep[];
}

export const FIRST_RUN_TOUR: TourDef = {
  id: "first-run",
  steps: [
    { route: "/", selector: '[data-tour="nav"]', titleKey: "tour.s1t", bodyKey: "tour.s1b" },
    { route: "/", selector: '[data-tour="open-problems"]', titleKey: "tour.s2t", bodyKey: "tour.s2b" },
    { route: "/", selector: '[data-tour="editor"]', titleKey: "tour.s3t", bodyKey: "tour.s3b" },
    { route: "/", selector: '[data-tour="run-submit"]', titleKey: "tour.s4t", bodyKey: "tour.s4b" },
    { route: "/techniques", selector: '[data-tour="techniques"]', titleKey: "tour.s5t", bodyKey: "tour.s5b" },
  ],
};

export const TOURS: Record<string, TourDef> = {
  "first-run": FIRST_RUN_TOUR,
};

export function tourDoneKey(id: string): string {
  return `airlock.tour.${id}.done`;
}

export function isTourDone(id: string): boolean {
  try {
    return localStorage.getItem(tourDoneKey(id)) === "1";
  } catch {
    return false;
  }
}

export function markTourDone(id: string): void {
  try {
    localStorage.setItem(tourDoneKey(id), "1");
  } catch {
    // ignore
  }
}

export function resetTour(id: string): void {
  try {
    localStorage.removeItem(tourDoneKey(id));
  } catch {
    // ignore
  }
}
