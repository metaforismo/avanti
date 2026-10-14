import type { Language, PilotLeadRequest } from "@avanti/contracts";

const copy = {
  it: {
    requestSubject: "Lo sportello ti chiede un'integrazione",
    request: "Per proseguire con la tua pratica, lo sportello ti chiede questi documenti:",
    generic:
      "Lo sportello ti chiede un'integrazione. Leggi la richiesta nel link della tua pratica.",
    link: "Apri il link che hai salvato; se l'hai perso chiedi allo sportello un nuovo link.",
    readySubject: "Puoi prenotare l'appuntamento allo sportello",
    ready:
      "La tua pratica è pronta per il prossimo passaggio. Puoi prenotare l'appuntamento allo sportello.",
  },
  en: {
    requestSubject: "The desk needs more documents",
    request: "To continue with your application, the desk needs these documents:",
    generic: "The desk needs more information. Read the request using your saved application link.",
    link: "Open the link you saved; if you have lost it, ask the desk for a new link.",
    readySubject: "You can book an appointment at the desk",
    ready: "Your application is ready for the next step. You can book an appointment at the desk.",
  },
  fr: {
    requestSubject: "Le guichet vous demande des documents complémentaires",
    request: "Pour poursuivre votre demande, le guichet vous demande ces documents :",
    generic:
      "Le guichet vous demande un complément. Lisez le message dans le lien de votre demande.",
    link: "Ouvrez le lien que vous avez enregistré ; si vous l'avez perdu, demandez un nouveau lien au guichet.",
    readySubject: "Vous pouvez prendre rendez-vous au guichet",
    ready:
      "Votre demande est prête pour la prochaine étape. Vous pouvez prendre rendez-vous au guichet.",
  },
  es: {
    requestSubject: "La ventanilla te pide documentos adicionales",
    request: "Para continuar con tu trámite, la ventanilla te pide estos documentos:",
    generic:
      "La ventanilla te pide información adicional. Lee el mensaje en el enlace de tu trámite.",
    link: "Abre el enlace que has guardado; si lo has perdido, pide uno nuevo en la ventanilla.",
    readySubject: "Puedes reservar una cita en la ventanilla",
    ready:
      "Tu trámite está listo para el siguiente paso. Puedes reservar una cita en la ventanilla.",
  },
  ro: {
    requestSubject: "Ghișeul îți cere documente suplimentare",
    request: "Pentru a continua cu cererea ta, ghișeul îți cere aceste documente:",
    generic: "Ghișeul îți cere informații suplimentare. Citește mesajul în linkul cererii tale.",
    link: "Deschide linkul pe care l-ai salvat; dacă l-ai pierdut, cere un link nou la ghișeu.",
    readySubject: "Poți face o programare la ghișeu",
    ready: "Cererea ta este pregătită pentru pasul următor. Poți face o programare la ghișeu.",
  },
  uk: {
    requestSubject: "Вікно обслуговування просить додаткові документи",
    request: "Щоб продовжити роботу з Вашою заявою, вікно обслуговування просить ці документи:",
    generic:
      "Вікно обслуговування просить додаткову інформацію. Прочитайте повідомлення за посиланням на Вашу заяву.",
    link: "Відкрийте збережене посилання; якщо Ви його втратили, попросіть нове у вікні обслуговування.",
    readySubject: "Ви можете записатися на прийом у вікні обслуговування",
    ready:
      "Ваша заява готова до наступного кроку. Ви можете записатися на прийом у вікні обслуговування.",
  },
  ar: {
    requestSubject: "شباك الخدمة يطلب وثائق إضافية",
    request: "لمتابعة طلبك، يطلب شباك الخدمة هذه الوثائق:",
    generic: "شباك الخدمة يطلب معلومات إضافية. اقرأ الرسالة عبر رابط طلبك.",
    link: "افتح الرابط الذي حفظته؛ إذا فقدته، اطلب رابطًا جديدًا من شباك الخدمة.",
    readySubject: "يمكنك حجز موعد في شباك الخدمة",
    ready: "طلبك جاهز للخطوة التالية. يمكنك حجز موعد في شباك الخدمة.",
  },
  bn: {
    requestSubject: "সেবা কাউন্টার অতিরিক্ত নথি চেয়েছে",
    request: "আপনার আবেদন এগিয়ে নিতে সেবা কাউন্টার এই নথিগুলি চেয়েছে:",
    generic: "সেবা কাউন্টার অতিরিক্ত তথ্য চেয়েছে। আপনার আবেদনের লিঙ্কে বার্তাটি পড়ুন।",
    link: "আপনার সংরক্ষিত লিঙ্কটি খুলুন; হারিয়ে গেলে সেবা কাউন্টার থেকে নতুন লিঙ্ক চান।",
    readySubject: "আপনি সেবা কাউন্টারে সাক্ষাতের সময় বুক করতে পারেন",
    ready:
      "আপনার আবেদন পরবর্তী ধাপের জন্য প্রস্তুত। আপনি সেবা কাউন্টারে সাক্ষাতের সময় বুক করতে পারেন।",
  },
} satisfies Record<
  Language,
  {
    requestSubject: string;
    request: string;
    generic: string;
    link: string;
    readySubject: string;
    ready: string;
  }
>;

export function citizenNotification(
  kind: "citizen_request" | "citizen_ready",
  language: Language,
  caf: string,
  titles: string[] = [],
) {
  const text = copy[language];
  return {
    subject: kind === "citizen_request" ? text.requestSubject : text.readySubject,
    text: [
      caf,
      kind === "citizen_ready" ? text.ready : titles.length ? text.request : text.generic,
      ...new Set(titles.map((title) => `• ${title}`)),
      text.link,
    ].join("\n\n"),
  };
}

export function leadNotification(input: PilotLeadRequest) {
  return {
    subject: "Nuova candidatura al pilota Avanti",
    text: [
      `Nome: ${input.name}`,
      `Organizzazione: ${input.organization}`,
      `Email: ${input.email}`,
      ...(input.role ? [`Ruolo: ${input.role}`] : []),
      ...(input.phone ? [`Telefono: ${input.phone}`] : []),
      ...(input.offices !== undefined ? [`Sportelli: ${input.offices}`] : []),
      ...(input.message ? [`Messaggio: ${input.message}`] : []),
      "Consenso al ricontatto: sì",
    ].join("\n"),
  };
}

export function digestNotification(count: number) {
  return {
    subject: "Riepilogo giornaliero Avanti",
    text: `Pratiche da revisionare: ${count}.\n\nApri la console per consultare la coda.`,
  };
}
