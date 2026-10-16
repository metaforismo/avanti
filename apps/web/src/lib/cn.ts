import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scale: without this it reads `text-body-sm` as a
// text colour and drops the colour next to it (white on the primary button became ink on blue).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["body-sm"] }],
      shadow: [{ shadow: ["raised", "float", "dock"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
