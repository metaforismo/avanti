import { expect, it } from "vitest";
import { canonicalMailbox } from "./canonical-mailbox";

it.each([
  ["  Vittima@EXAMPLE.IT.  ", "vittima@example.it"],
  ["Vittima+1@example.it", "vittima@example.it"],
  ["vittima+2+extra@example.it", "vittima@example.it"],
  ["vittima+@example.it", "vittima@example.it"],
  ["V.It.Tima+tag@GMAIL.COM.", "vittima@gmail.com"],
  ["v.ittima+tag@googlemail.com", "vittima@gmail.com"],
  ["vittima@googlemail.com", "vittima@gmail.com"],
  ["v.ittima+tag@example.it", "v.ittima@example.it"],
  ["v.ittima+tag@sub.gmail.com", "v.ittima@sub.gmail.com"],
  ["v.ittima+tag@gmail.com.example.it", "v.ittima@gmail.com.example.it"],
  ["other@example.it", "other@example.it"],
])("canonicalizes %s to %s only for the abuse budget", (email, expected) => {
  expect(canonicalMailbox(email)).toBe(expected);
  expect(canonicalMailbox(expected)).toBe(expected);
});
