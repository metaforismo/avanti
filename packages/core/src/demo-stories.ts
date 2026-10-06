export const DEMO_STORIES = {
  it: "Devo fare l'ISEE, vivo con mia madre, mio padre non vive con noi, ho un conto Fineco e una macchina.",
  bn: "আমাকে ISEE করতে হবে, আমি আমার মায়ের সাথে থাকি, আমার বাবা আমাদের সাথে থাকেন না, আমার একটি Fineco অ্যাকাউন্ট আর একটি গাড়ি আছে।",
  ar: "أحتاج إلى عمل الـ ISEE، أعيش مع أمي، وأبي لا يعيش معنا، لدي حساب في Fineco وسيارة.",
  uk: "Мені потрібно зробити ISEE, я живу з мамою, тато з нами не живе, у мене є рахунок у Fineco і машина.",
  en: "I need to do the ISEE. I live with my mother, my father doesn't live with us, I have a Fineco account and a car.",
} as const;

export const DEMO_EXPECTED = {
  practiceId: "isee_ordinario",
  answers: {
    household_count: 2,
    household_roles: ["richiedente", "genitore"],
    household_relations: ["madre"],
    applicant_parent_nonresident: true,
    accounts_count: 1,
    account_bank_0: "Fineco",
    account_type_0: "deposit",
    vehicles_count: 1,
  },
} as const;
