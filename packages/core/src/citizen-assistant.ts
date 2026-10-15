import type { AssistantAsk, AssistantIntent, CitizenCase, Language } from "@avanti/contracts";
import { localize, type Text } from "./i18n";

const copy = {
  desk: [
    "Per questa domanda serve l’operatore. Puoi inviare una domanda allo sportello.",
    "The operator needs to help with this question. You can send a question to the desk.",
    "Un agent doit vous aider pour cette question. Vous pouvez envoyer une question au guichet.",
    "El operador debe ayudarte con esta pregunta. Puedes enviar una pregunta a la ventanilla.",
    "Operatorul trebuie să te ajute cu această întrebare. Poți trimite o întrebare la ghișeu.",
    "З цим запитанням Вам допоможе працівник. Ви можете надіслати запитання у вікно обслуговування.",
    "يحتاج هذا السؤال إلى موظف. يمكنك إرسال سؤال إلى شباك الخدمة.",
    "এই প্রশ্নে কর্মীর সাহায্য দরকার। আপনি সেবা কাউন্টারে প্রশ্ন পাঠাতে পারেন।",
  ],
  scope: [
    "Posso aiutarti con le domande e i documenti della pratica.",
    "I can help you with your application questions and documents.",
    "Je peux vous aider avec les questions et les documents de votre demande.",
    "Puedo ayudarte con las preguntas y los documentos de tu trámite.",
    "Te pot ajuta cu întrebările și documentele cererii tale.",
    "Я можу допомогти Вам із запитаннями та документами Вашої заяви.",
    "يمكنني مساعدتك في أسئلة طلبك ووثائقه.",
    "আমি আপনার আবেদনের প্রশ্ন ও নথি নিয়ে সাহায্য করতে পারি।",
  ],
  emergency: [
    "Se sei in pericolo, chiama subito il 112. Anche lo sportello può aiutarti.",
    "If you are in danger, call 112 now. The desk can also help you.",
    "Si vous êtes en danger, appelez le 112 maintenant. Le guichet peut aussi vous aider.",
    "Si estás en peligro, llama al 112 ahora. La ventanilla también puede ayudarte.",
    "Dacă ești în pericol, sună acum la 112. Ghișeul te poate ajuta.",
    "Якщо Ви в небезпеці, негайно телефонуйте 112. У вікні обслуговування Вам також допоможуть.",
    "إذا كنت في خطر، اتصل الآن بالرقم 112. يمكن لشباك الخدمة مساعدتك أيضًا.",
    "আপনি বিপদে থাকলে এখনই 112 নম্বরে কল করুন। সেবা কাউন্টারও সাহায্য করতে পারে।",
  ],
  secrets: [
    "Non condividere credenziali o codici di accesso, nemmeno con il CAF.",
    "Do not share credentials or access codes, even with the CAF.",
    "Ne partagez pas vos identifiants ou codes d’accès, même avec le CAF.",
    "No compartas credenciales ni códigos de acceso, tampoco con el CAF.",
    "Nu partaja date de acces sau coduri, nici cu CAF.",
    "Не передавайте Ваші облікові дані чи коди доступу навіть CAF.",
    "لا تشارك بيانات الدخول أو رموز الوصول، حتى مع CAF.",
    "আপনার লগইন তথ্য বা প্রবেশের কোড CAF-কেও দেবেন না।",
  ],
  invalid: [
    "Scrivi un messaggio da 1 a 600 caratteri.",
    "Write a message of 1 to 600 characters.",
    "Écrivez un message de 1 à 600 caractères.",
    "Escribe un mensaje de 1 a 600 caracteres.",
    "Scrie un mesaj de la 1 la 600 de caractere.",
    "Напишіть повідомлення від 1 до 600 символів.",
    "اكتب رسالة من 1 إلى 600 حرف.",
    "১ থেকে ৬০০ অক্ষরের বার্তা লিখুন।",
  ],
  audioUnavailable: [
    "La trascrizione non è disponibile. Scrivi il messaggio.",
    "Transcription is unavailable. Type your message.",
    "La transcription est indisponible. Écrivez votre message.",
    "La transcripción no está disponible. Escribe tu mensaje.",
    "Transcrierea nu este disponibilă. Scrie mesajul.",
    "Транскрипція недоступна. Напишіть Ваше повідомлення.",
    "التفريغ الصوتي غير متاح. اكتب رسالتك.",
    "কথা থেকে লেখা এখন পাওয়া যাচ্ছে না। আপনার বার্তা লিখুন।",
  ],
  audioInvalid: [
    "Carica un audio valido di massimo 60 secondi e 2 MB.",
    "Upload valid audio up to 60 seconds and 2 MB.",
    "Envoyez un audio valide de 60 secondes et 2 Mo maximum.",
    "Sube un audio válido de hasta 60 segundos y 2 MB.",
    "Încarcă un audio valid de cel mult 60 de secunde și 2 MB.",
    "Завантажте аудіо до 60 секунд і 2 МБ.",
    "ارفع ملفًا صوتيًا صالحًا لا يزيد عن 60 ثانية و2 ميغابايت.",
    "সর্বোচ্চ ৬০ সেকেন্ড ও ২ এমবি আকারের সঠিক অডিও আপলোড করুন।",
  ],
  photos: [
    "Fotografa il documento su un piano, con buona luce, senza riflessi. Includi tutti gli angoli e le pagine richieste. Puoi caricare un PDF.",
    "Put the document flat in good light without glare. Include every corner and the required pages. You can upload a PDF.",
    "Posez le document à plat, avec une bonne lumière, sans reflet. Incluez tous les coins et les pages demandées. Vous pouvez envoyer un PDF.",
    "Pon el documento plano, con buena luz y sin reflejos. Incluye todas las esquinas y las páginas solicitadas. Puedes subir un PDF.",
    "Pune documentul pe o suprafață plană, la lumină, fără reflexii. Include toate colțurile și paginile cerute. Poți încărca un PDF.",
    "Покладіть документ рівно при доброму освітленні без відблисків. Покажіть усі кути та потрібні сторінки. Ви можете завантажити PDF.",
    "ضع الوثيقة على سطح مستوٍ بإضاءة جيدة دون انعكاس. أظهر كل الزوايا والصفحات المطلوبة. يمكنك رفع PDF.",
    "সমতলে ভালো আলোতে নথি রাখুন, আলো যেন প্রতিফলিত না হয়। সব কোণ ও চাওয়া পৃষ্ঠা রাখুন। আপনি PDF আপলোড করতে পারেন।",
  ],
  next: [
    "Dopo l’invio, l’operatore controlla il fascicolo. Se manca qualcosa, lo sportello può chiederti un’integrazione. Avanti prepara i documenti: l’operatore fa la pratica.",
    "After you submit, the operator checks the dossier. The desk may ask for missing information. Avanti prepares the documents. The operator handles the application.",
    "Après l’envoi, l’agent vérifie le dossier. Le guichet peut vous demander des éléments manquants. Avanti prépare les documents. L’agent traite la demande.",
    "Tras el envío, el operador revisa el expediente. La ventanilla puede pedirte lo que falta. Avanti prepara los documentos. El operador realiza el trámite.",
    "După trimitere, operatorul verifică dosarul. Ghișeul îți poate cere ce lipsește. Avanti pregătește documentele. Operatorul se ocupă de cerere.",
    "Після надсилання працівник перевірить справу. У Вас можуть попросити відсутні дані. Avanti готує документи. Працівник опрацьовує заяву.",
    "بعد الإرسال، يراجع الموظف الملف. قد يطلب منك شباك الخدمة ما ينقص. يجهز Avanti الوثائق ويتولى الموظف الطلب.",
    "পাঠানোর পরে কর্মী ফাইল দেখবেন। কিছু কম থাকলে সেবা কাউন্টার চাইতে পারে। Avanti নথি প্রস্তুত করে। কর্মী আবেদন পরিচালনা করেন।",
  ],
  pause: [
    "Puoi fermarti e riprendere con lo stesso link finché è valido. L’operatore verifica sempre il fascicolo.",
    "You can stop and return using the same link while it is valid. The operator always checks the dossier.",
    "Vous pouvez reprendre avec le même lien tant qu’il est valide. L’agent vérifie toujours le dossier.",
    "Puedes parar y volver con el mismo enlace mientras sea válido. El operador siempre revisa el expediente.",
    "Poți reveni cu același link cât timp este valabil. Operatorul verifică întotdeauna dosarul.",
    "Ви можете повернутися за тим самим посиланням, поки воно дійсне. Працівник завжди перевіряє справу.",
    "يمكنك التوقف والعودة بالرابط نفسه ما دام صالحًا. يراجع الموظف الملف دائمًا.",
    "লিঙ্ক কার্যকর থাকা পর্যন্ত একই লিঙ্কে ফিরে আসতে পারেন। কর্মী সব সময় ফাইল যাচাই করেন।",
  ],
} satisfies Record<string, Text>;
export function citizenAssistantCopy(key: keyof typeof copy, language: Language): string {
  return localize(language, copy[key]);
}
export type AssistantContextItem = {
  id: string;
  title: string;
  text: string;
  kind: "practice" | "question" | "document" | "faq" | "office";
};
export function assistantContext(
  view: CitizenCase,
  focus?: AssistantAsk["focus"],
): AssistantContextItem[] {
  const items: AssistantContextItem[] = [];
  if (view.practice)
    items.push({
      id: `practice:${view.practice.id}`,
      title: view.practice.name,
      text: view.practice.description,
      kind: "practice",
    });
  if (view.nextQuestion && (!focus?.questionId || focus.questionId === view.nextQuestion.id))
    items.push({
      id: `question:${view.nextQuestion.id}`,
      title: view.nextQuestion.prompt,
      text: view.nextQuestion.help ?? view.nextQuestion.prompt,
      kind: "question",
    });
  for (const item of view.checklist)
    items.push({
      id: `checklist:${item.id}`,
      title: item.title,
      text: [item.description, item.howToGet].filter(Boolean).join("\n"),
      kind: "document",
    });
  for (const key of ["photos", "next", "pause", "secrets", "emergency"] as const)
    items.push({
      id: `faq:${key}`,
      title: citizenAssistantCopy(key, view.language),
      text: citizenAssistantCopy(key, view.language),
      kind: "faq",
    });
  if (view.office)
    items.push({
      id: `office:${view.office.id}`,
      title: view.office.name,
      text: JSON.stringify({
        address: view.office.address,
        openingHours: view.office.openingHours,
        bookingUrl: view.office.bookingUrl,
        citizenNote: view.office.citizenNote,
      }),
      kind: "office",
    });
  return items;
}
export function assistantSafetyIntent(text: string): AssistantIntent | null {
  if (
    /emergenz|mi picchia|mi sta picchiando|i am in danger|someone is hurting me|urgence|en danger|me golpea|estoy en peligro|urgență|în pericol|небезпец|небезпек|насиль|خطر|يضربني|طوارئ|বিপদ|মারছে|112|suicid|uccid|ammazz|non respiro|kill myself|can't breathe|cannot breathe|me mat|no puedo respirar|ne peux pas respirer|tuer|sinucid|nu pot respira|самогуб|вбити|не можу дихати|انتحار|أقتل|لا أستطيع التنفس|আত্মহত্যা|শ্বাস নিতে পারছি না/iu.test(
      text,
    )
  )
    return "emergency";
  if (
    /ignore|ignor[ăa]|instructions|istruzioni|system\s*:|developer|operatore|operator|administrat|opérateur|operador|оператор|موظف|কর্মী|تجاهل|ігнор|উপেক্ষা/iu.test(
      text,
    ) &&
    /ignore|ignor[ăa]|instructions|istruzioni|system\s*:|developer|sono l|i am|je suis|soy el|sunt operator|я оператор|أنا الموظف|আমি কর্মী|تجاهل|ігнор|উপেক্ষা/iu.test(
      text,
    )
  )
    return "manipulation";
  if (
    /\b(?:spid|otp|password|pin|puk|cvv)\b|mot de passe|contraseña|parolă|парол|كلمة المرور|رمز التحقق|পাসওয়ার্ড/iu.test(
      text,
    )
  )
    return "needs_operator";
  return null;
}
export function heuristicAssistant(input: {
  message: string;
  language: Language;
  context: AssistantContextItem[];
  focus?: AssistantAsk["focus"];
}) {
  const safety = assistantSafetyIntent(input.message);
  const result = (
    reply: string,
    intent: AssistantIntent,
    action: "none" | "explain_question" | "open_documents" | "ask_desk",
    sources: string[] = [],
  ) => ({ reply, intent, action, sources });
  if (safety)
    return result(
      citizenAssistantCopy(
        safety === "emergency" ? "emergency" : safety === "manipulation" ? "scope" : "secrets",
        input.language,
      ),
      safety,
      safety === "needs_operator" ? "ask_desk" : "none",
    );
  if (
    /mi spetta|ho diritto|quanto (?:ricevo|prendo)|eligible|entitled|how much|ai-je droit|éligible|me corresponde|tengo derecho|cuánto|am drept|eligibil|маю право|належить|скільки|أستحق|كم أحصل|পাব কি|কত পাব/iu.test(
      input.message,
    )
  )
    return result(citizenAssistantCopy("desk", input.language), "needs_operator", "ask_desk");
  if (
    /poesi|poem|poème|poezi|вірш|قصيدة|কবিতা|barzellett|joke|blague|chiste|glum|жарт|نكتة|কৌতুক/iu.test(
      input.message,
    )
  )
    return result(citizenAssistantCopy("scope", input.language), "off_topic", "none");
  const question = input.context.find((i) => i.kind === "question");
  if (
    question &&
    (input.focus?.questionId ||
      /perché|why|pourquoi|por qué|de ce|чому|لماذا|কেন/iu.test(input.message))
  )
    return result(question.text, "answer", "explain_question", [question.id]);
  const message = input.message.toLocaleLowerCase();
  const focused = input.context.find(
    (i) => i.kind === "document" && i.id === `checklist:${input.focus?.checklistItemId}`,
  );
  const document =
    focused ??
    input.context.find(
      (i) =>
        i.kind === "document" &&
        i.title
          .toLocaleLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .some(
            (w) =>
              (w.length >= 3 || /^(?:cu|cf|id)$/iu.test(w)) &&
              new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, "u").test(message),
          ),
    );
  if (document) return result(document.text, "answer", "open_documents", [document.id]);
  if (/foto|photo|ছবি|صورة|صور|фото/iu.test(message))
    return result(citizenAssistantCopy("photos", input.language), "answer", "open_documents", [
      "faq:photos",
    ]);
  return result(citizenAssistantCopy("desk", input.language), "needs_operator", "ask_desk");
}
