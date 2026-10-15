// Emergency (112) and anti-violence (1522) numbers: one tap to call, from a phone in a hurry.
const EMERGENCY = /(?<![\d+])(112|1522)(?!\d)/g;

export function WithCallLinks({ text }: { text: string }) {
  const parts = text.split(EMERGENCY);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={`tel:${part}`}
        dir="ltr"
        className="font-bold whitespace-nowrap text-danger underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
