import type { Language } from "@avanti/contracts";

const copy: Record<Language, { subject: string; text: string }> = {
  it: {
    subject: "Promemoria dallo sportello",
    text: "Lo sportello è in attesa della tua risposta. Leggi la richiesta nel link che hai salvato. Se hai già risposto, ignora questo messaggio. Se hai bisogno di aiuto o hai perso il link, contatta lo sportello.",
  },
  en: {
    subject: "Reminder from the desk",
    text: "The desk is waiting for your reply. Read the request using the link you saved. If you have already replied, ignore this message. If you need help or have lost the link, contact the desk.",
  },
  fr: {
    subject: "Rappel du guichet",
    text: "Le guichet attend votre réponse. Lisez le message en utilisant le lien que vous avez enregistré. Si vous avez déjà répondu, ignorez ce message. Si vous avez besoin d’aide ou avez perdu le lien, contactez le guichet.",
  },
  es: {
    subject: "Recordatorio de la ventanilla",
    text: "La ventanilla está esperando tu respuesta. Lee la solicitud en el enlace que has guardado. Si ya has respondido, ignora este mensaje. Si necesitas ayuda o has perdido el enlace, contacta con la ventanilla.",
  },
  ro: {
    subject: "Memento de la ghișeu",
    text: "Ghișeul așteaptă răspunsul tău. Citește solicitarea folosind linkul pe care l-ai salvat. Dacă ai răspuns deja, ignoră acest mesaj. Dacă ai nevoie de ajutor sau ai pierdut linkul, contactează ghișeul.",
  },
  uk: {
    subject: "Нагадування від вікна обслуговування",
    text: "Вікно обслуговування очікує на Вашу відповідь. Прочитайте запит за збереженим посиланням. Якщо Ви вже відповіли, не зважайте на це повідомлення. Якщо Вам потрібна допомога або Ви втратили посилання, зверніться до вікна обслуговування.",
  },
  ar: {
    subject: "تذكير من شباك الخدمة",
    text: "شباك الخدمة ينتظر ردك. اقرأ الطلب عبر الرابط الذي حفظته. إذا كنت قد رددت بالفعل، فتجاهل هذه الرسالة. إذا احتجت إلى مساعدة أو فقدت الرابط، فتواصل مع شباك الخدمة.",
  },
  bn: {
    subject: "সেবা কাউন্টার থেকে মনে করিয়ে দেওয়া বার্তা",
    text: "সেবা কাউন্টার আপনার উত্তরের অপেক্ষায় আছে। আপনার সংরক্ষিত লিঙ্কে অনুরোধটি পড়ুন। আপনি ইতিমধ্যে উত্তর দিয়ে থাকলে এই বার্তাটি উপেক্ষা করুন। সাহায্যের প্রয়োজন হলে বা লিঙ্কটি হারিয়ে গেলে সেবা কাউন্টারে যোগাযোগ করুন।",
  },
};

export function reminderNotification(language: Language) {
  return copy[language];
}
