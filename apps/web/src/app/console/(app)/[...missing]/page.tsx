import { notFound } from "next/navigation";

/** Any unknown console address stays inside the console, with its own not-found page. */
export default function MissingConsolePage() {
  notFound();
}
