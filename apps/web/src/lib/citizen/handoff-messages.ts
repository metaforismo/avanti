import type { Language } from "@avanti/contracts";
import type { PluralForms } from "@avanti/core/plural";

/**
 * What the desk hands to a citizen who left no email (a WhatsApp/SMS notice) or has no
 * smartphone (a printed list). Register and glossary follow docs/decisions/citizen-copy.md.
 * Arabic lines start with Arabic words, and the console marks each line's direction as well.
 * `requestIntro` names no number, so it changes only between one document and several (and
 * the Arabic dual for two).
 */
const it = {
  requestIntro: {
    "=1": "{org}: per la pratica {ref} lo sportello ti chiede ancora questo documento:",
    other: "{org}: per la pratica {ref} lo sportello ti chiede ancora questi documenti:",
  } as PluralForms,
  requestGeneric: "{org}: per la pratica {ref} lo sportello ti chiede un'integrazione.",
  readyIntro: "{org}: la pratica {ref} è pronta. Ora prenota l'appuntamento allo sportello.",
  savedLink:
    "Leggi la richiesta e carica i documenti dal link della tua pratica. Se l'hai perso, chiedi allo sportello un nuovo link.",
  newLink:
    "Leggi la richiesta e carica i documenti da questo nuovo link (quello vecchio non funziona più):",
  readySavedLink: "Trovi le indicazioni nel link della tua pratica.",
  readyNewLink: "Trovi le indicazioni in questo nuovo link (quello vecchio non funziona più):",
  book: "Prenota l'appuntamento qui:",
  sheetTitle: "Documenti da portare allo sportello",
  sheetLead: "Spunta ogni documento quando lo trovi e porta tutto allo sportello.",
  sheetEmpty: "Non manca nessun documento.",
  sheetDate: "Elenco del {date}",
};

export type HandoffMessages = typeof it;

export const HANDOFF_MESSAGES: Record<Language, HandoffMessages> = {
  it,
  en: {
    requestIntro: {
      "=1": "{org}: for application {ref}, the desk still needs this document:",
      other: "{org}: for application {ref}, the desk still needs these documents:",
    },
    requestGeneric: "{org}: for application {ref}, the desk needs more information.",
    readyIntro: "{org}: application {ref} is ready. Now book your appointment at the desk.",
    savedLink:
      "Read the request and upload the documents using your application link. If you have lost it, ask the desk for a new link.",
    newLink:
      "Read the request and upload the documents using this new link (the old one no longer works):",
    readySavedLink: "Open your application link for the details.",
    readyNewLink: "You'll find the details in this new link (the old one no longer works):",
    book: "Book your appointment here:",
    sheetTitle: "Documents to bring to the desk",
    sheetLead: "Tick each document when you find it and bring everything to the desk.",
    sheetEmpty: "No documents are missing.",
    sheetDate: "List dated {date}",
  },
  fr: {
    requestIntro: {
      "=1": "{org} : pour votre demande {ref}, le guichet vous demande encore ce document :",
      other: "{org} : pour votre demande {ref}, le guichet vous demande encore ces documents :",
    },
    requestGeneric:
      "{org} : pour votre demande {ref}, le guichet vous demande un complément d'information.",
    readyIntro: "{org} : votre demande {ref} est prête. Prenez maintenant rendez-vous au guichet.",
    savedLink:
      "Lisez le message et envoyez les documents depuis le lien de votre demande. Si vous l'avez perdu, demandez un nouveau lien au guichet.",
    newLink:
      "Lisez le message et envoyez les documents depuis ce nouveau lien (l'ancien ne fonctionne plus) :",
    readySavedLink: "Vous trouverez les indications dans le lien de votre demande.",
    readyNewLink:
      "Vous trouverez les indications dans ce nouveau lien (l'ancien ne fonctionne plus) :",
    book: "Prenez rendez-vous ici :",
    sheetTitle: "Documents à apporter au guichet",
    sheetLead: "Cochez chaque document quand vous l'avez trouvé et apportez le tout au guichet.",
    sheetEmpty: "Aucun document ne manque.",
    sheetDate: "Liste du {date}",
  },
  es: {
    requestIntro: {
      "=1": "{org}: para tu trámite {ref}, la ventanilla todavía te pide este documento:",
      other: "{org}: para tu trámite {ref}, la ventanilla todavía te pide estos documentos:",
    },
    requestGeneric: "{org}: para tu trámite {ref}, la ventanilla te pide información adicional.",
    readyIntro: "{org}: tu trámite {ref} está listo. Ahora reserva tu cita en la ventanilla.",
    savedLink:
      "Lee el mensaje y sube los documentos desde el enlace de tu trámite. Si lo has perdido, pide uno nuevo en la ventanilla.",
    newLink:
      "Lee el mensaje y sube los documentos desde este nuevo enlace (el anterior ya no funciona):",
    readySavedLink: "Encontrarás las indicaciones en el enlace de tu trámite.",
    readyNewLink: "Encontrarás las indicaciones en este nuevo enlace (el anterior ya no funciona):",
    book: "Reserva tu cita aquí:",
    sheetTitle: "Documentos para llevar a la ventanilla",
    sheetLead: "Marca cada documento cuando lo encuentres y llévalo todo a la ventanilla.",
    sheetEmpty: "No falta ningún documento.",
    sheetDate: "Lista del {date}",
  },
  ro: {
    requestIntro: {
      "=1": "{org}: pentru cererea ta {ref}, ghișeul îți mai cere acest document:",
      other: "{org}: pentru cererea ta {ref}, ghișeul îți mai cere aceste documente:",
    },
    requestGeneric: "{org}: pentru cererea ta {ref}, ghișeul îți cere informații suplimentare.",
    readyIntro: "{org}: cererea ta {ref} este gata. Acum fă-ți programarea la ghișeu.",
    savedLink:
      "Citește mesajul și încarcă documentele din linkul cererii tale. Dacă l-ai pierdut, cere un link nou la ghișeu.",
    newLink:
      "Citește mesajul și încarcă documentele din acest link nou (cel vechi nu mai funcționează):",
    readySavedLink: "Găsești indicațiile în linkul cererii tale.",
    readyNewLink: "Găsești indicațiile în acest link nou (cel vechi nu mai funcționează):",
    book: "Fă-ți programarea aici:",
    sheetTitle: "Documente de adus la ghișeu",
    sheetLead: "Bifează fiecare document când îl găsești și adu-le pe toate la ghișeu.",
    sheetEmpty: "Nu lipsește niciun document.",
    sheetDate: "Lista din {date}",
  },
  uk: {
    requestIntro: {
      "=1": "{org}: для Вашої заяви {ref} вікно обслуговування ще просить цей документ:",
      other: "{org}: для Вашої заяви {ref} вікно обслуговування ще просить ці документи:",
    },
    requestGeneric:
      "{org}: для Вашої заяви {ref} вікно обслуговування просить додаткову інформацію.",
    readyIntro:
      "{org}: Ваша заява {ref} готова. Тепер запишіться на прийом у вікні обслуговування.",
    savedLink:
      "Прочитайте повідомлення й завантажте документи за посиланням на Вашу заяву. Якщо Ви його втратили, попросіть нове у вікні обслуговування.",
    newLink:
      "Прочитайте повідомлення й завантажте документи за цим новим посиланням (старе більше не працює):",
    readySavedLink: "Подробиці — за посиланням на Вашу заяву.",
    readyNewLink: "Подробиці — за цим новим посиланням (старе більше не працює):",
    book: "Запишіться на прийом тут:",
    sheetTitle: "Документи, які треба принести до вікна обслуговування",
    sheetLead:
      "Позначайте кожен документ, коли його знайдете, і принесіть усе до вікна обслуговування.",
    sheetEmpty: "Усі документи вже є.",
    sheetDate: "Список від {date}",
  },
  ar: {
    requestIntro: {
      "=1": "طلبك {ref} لدى {org}: ما زال شباك الخدمة يطلب هذه الوثيقة:",
      two: "طلبك {ref} لدى {org}: ما زال شباك الخدمة يطلب هاتين الوثيقتين:",
      other: "طلبك {ref} لدى {org}: ما زال شباك الخدمة يطلب هذه الوثائق:",
    },
    requestGeneric: "طلبك {ref} لدى {org}: يطلب شباك الخدمة معلومات إضافية.",
    readyIntro: "طلبك {ref} لدى {org} جاهز. احجز الآن موعدك في شباك الخدمة.",
    savedLink:
      "اقرأ الرسالة وارفع الوثائق عبر رابط طلبك. إذا فقدته، اطلب رابطًا جديدًا من شباك الخدمة.",
    newLink: "اقرأ الرسالة وارفع الوثائق عبر هذا الرابط الجديد (الرابط القديم لم يعد يعمل):",
    readySavedLink: "تجد التعليمات في رابط طلبك.",
    readyNewLink: "تجد التعليمات في هذا الرابط الجديد (الرابط القديم لم يعد يعمل):",
    book: "احجز موعدك هنا:",
    sheetTitle: "الوثائق التي يجب إحضارها إلى شباك الخدمة",
    sheetLead: "ضع علامة على كل وثيقة عندما تجدها، وأحضر كل شيء إلى شباك الخدمة.",
    sheetEmpty: "لا توجد وثائق ناقصة.",
    sheetDate: "قائمة بتاريخ {date}",
  },
  bn: {
    requestIntro: {
      "=1": "{org}: আপনার আবেদন {ref}-এর জন্য সেবা কাউন্টার এখনও এই নথিটি চাইছে:",
      other: "{org}: আপনার আবেদন {ref}-এর জন্য সেবা কাউন্টার এখনও এই নথিগুলি চাইছে:",
    },
    requestGeneric: "{org}: আপনার আবেদন {ref}-এর জন্য সেবা কাউন্টার অতিরিক্ত তথ্য চেয়েছে।",
    readyIntro: "{org}: আপনার আবেদন {ref} প্রস্তুত। এখন সেবা কাউন্টারে সাক্ষাতের সময় বুক করুন।",
    savedLink:
      "আপনার আবেদনের লিংকে বার্তাটি পড়ুন এবং নথিগুলি আপলোড করুন। লিংক হারিয়ে গেলে সেবা কাউন্টার থেকে নতুন লিংক চান।",
    newLink: "এই নতুন লিংকে বার্তাটি পড়ুন এবং নথিগুলি আপলোড করুন (পুরোনোটি আর কাজ করে না):",
    readySavedLink: "আপনার আবেদনের লিংকে নির্দেশনা পাবেন।",
    readyNewLink: "এই নতুন লিংকে নির্দেশনা পাবেন (পুরোনোটি আর কাজ করে না):",
    book: "এখানে সাক্ষাতের সময় বুক করুন:",
    sheetTitle: "সেবা কাউন্টারে যে নথিগুলি আনতে হবে",
    sheetLead: "প্রতিটি নথি পেলে টিক দিন এবং সবকিছু সেবা কাউন্টারে নিয়ে আসুন।",
    sheetEmpty: "কোনো নথি বাকি নেই।",
    sheetDate: "{date} তারিখের তালিকা",
  },
};
