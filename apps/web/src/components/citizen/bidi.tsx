import { Fragment } from "react";
import { latinRuns } from "@/lib/citizen/bidi";

/**
 * Text that may mix scripts: in an Arabic sentence each Italian term («(giacenza media)», «ISEE
 * ordinario», a bank) is isolated, so the algorithm can't pull its brackets and the numbers next
 * to it to the wrong side. Text without right-to-left letters renders as it is.
 */
export function Bidi({ text }: { text: string }) {
  const parts = latinRuns(text);
  if (parts.length === 1 && !parts[0]!.latin) return text;
  return parts.map((part, index) =>
    part.latin ? (
      // A short term stays on one line: «(giacenza / media)» split across two lines reads as
      // two fragments in a right-to-left paragraph.
      <bdi
        key={index}
        dir="ltr"
        className={Array.from(part.text).length <= 28 ? "whitespace-nowrap" : undefined}
      >
        {part.text}
      </bdi>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );
}
