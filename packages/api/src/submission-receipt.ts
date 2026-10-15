import type { Language } from "@avanti/contracts";

const copy = {
  it: {
    subject: "Il tuo fascicolo è arrivato allo sportello",
    reference: "Riferimento della pratica",
    office: "Sportello",
    next: "Lo sportello controllerà il fascicolo. L'invio non prenota un appuntamento e non conclude la pratica. Apri la pagina della pratica che hai salvato per trovare le indicazioni dello sportello su prenotazione, orari e cosa portare. Se non trovi queste indicazioni, chiedi allo sportello come proseguire.",
  },
  en: {
    subject: "Your dossier has reached the desk",
    reference: "Application reference",
    office: "Desk",
    next: "The desk will check your dossier. Submitting it does not book an appointment or complete your application. Open your saved application page for the desk's instructions on booking, opening hours and what to bring. If there are no instructions, ask the desk how to continue.",
  },
  fr: {
    subject: "Votre dossier est arrivé au guichet",
    reference: "Référence de votre dossier",
    office: "Guichet",
    next: "Le guichet vérifiera votre dossier. Cet envoi ne réserve pas de rendez-vous et ne termine pas la procédure. Ouvrez la page de votre dossier que vous avez enregistrée pour consulter les indications du guichet sur les rendez-vous, les horaires et les documents à apporter. Sans ces indications, contactez le guichet pour savoir comment continuer.",
  },
  es: {
    subject: "Tu expediente ha llegado a la ventanilla",
    reference: "Referencia del trámite",
    office: "Ventanilla",
    next: "La ventanilla revisará tu expediente. El envío no reserva una cita ni finaliza tu trámite. Abre la página de tu trámite que has guardado para consultar las indicaciones de la ventanilla sobre citas, horarios y qué llevar. Si no hay indicaciones, pregunta en la ventanilla cómo continuar.",
  },
  ro: {
    subject: "Dosarul tău a ajuns la ghișeu",
    reference: "Referința cererii",
    office: "Ghișeu",
    next: "Ghișeul va verifica dosarul tău. Trimiterea nu face o programare și nu încheie cererea ta. Deschide pagina cererii pe care ai salvat-o pentru indicațiile ghișeului despre programări, orar și ce să aduci. Dacă nu găsești indicații, întreabă la ghișeu cum să continui.",
  },
  uk: {
    subject: "Ваші документи надійшли до вікна обслуговування",
    reference: "Номер заяви",
    office: "Вікно обслуговування",
    next: "Вікно обслуговування перевірить Ваші документи. Надсилання не записує Вас на прийом і не завершує оформлення заяви. Відкрийте збережену сторінку Вашої заяви, щоб знайти вказівки щодо запису, годин роботи та документів, які потрібно взяти із собою. Якщо вказівок немає, запитайте у вікні обслуговування, як діяти далі.",
  },
  ar: {
    subject: "وصل ملفك إلى شباك الخدمة",
    reference: "رقم الطلب",
    office: "شباك الخدمة",
    next: "سيراجع شباك الخدمة ملفك. إرسال الملف لا يحجز موعدًا ولا يُكمل طلبك. افتح صفحة طلبك التي حفظتها للاطلاع على تعليمات شباك الخدمة بشأن الحجز وساعات العمل وما يجب إحضاره. إذا لم تجد تعليمات، اسأل شباك الخدمة عن الخطوة التالية.",
  },
  bn: {
    subject: "আপনার ফাইল সেবা কাউন্টারে পৌঁছেছে",
    reference: "আবেদনের রেফারেন্স নম্বর",
    office: "সেবা কাউন্টার",
    next: "সেবা কাউন্টার আপনার ফাইল পরীক্ষা করবে। ফাইল পাঠালে সাক্ষাতের সময় বুক হয় না এবং আপনার আবেদনের প্রক্রিয়া শেষ হয় না। বুকিং, খোলার সময় এবং কী সঙ্গে আনতে হবে তা জানতে আপনার সংরক্ষিত আবেদনের পৃষ্ঠাটি খুলুন। নির্দেশনা না থাকলে পরবর্তী ধাপ সম্পর্কে সেবা কাউন্টারে জিজ্ঞাসা করুন।",
  },
} satisfies Record<Language, { subject: string; reference: string; office: string; next: string }>;

export function submissionReceipt(language: Language, reference: string, officeName: string) {
  const text = copy[language];
  // Mail clients auto-link domains too: admin-supplied names must not introduce links.
  const name = officeName.normalize("NFKC").replace(/[.:/@\\\u3002\uFF61]/gu, " ");
  return {
    subject: text.subject,
    text: [`${text.reference}: ${reference}`, `${text.office}: ${name}`, text.next].join("\n\n"),
  };
}
