import type {
  ChecklistItem,
  DocumentSummary,
  Finding,
  Language,
  Member,
  PracticeId,
  Progress,
} from "@avanti/contracts";
import { catalog, getQuestions, type Answers } from "./catalog";
import { normalizedName } from "./household";
import { localize, type Text } from "./i18n";
import { requirements, type RequirementId } from "./requirements";
import { validDate } from "./interview";
import { calendarDate, calendarYear } from "./calendar";

const messages = {
  "practice.household_review": [
    "Il CAF verifica i coniugi e i figli a carico che vivono altrove: il nucleo ISEE può essere diverso dalle sole persone conviventi.",
    "The CAF checks spouses and dependent children living elsewhere. The ISEE household may include people at other addresses.",
    "Le CAF vérifie les conjoints et enfants à charge vivant ailleurs. Le foyer ISEE peut comprendre des personnes à d’autres adresses.",
    "El CAF revisa los cónyuges e hijos a cargo que viven fuera. La familia ISEE puede incluir personas con otra dirección.",
    "CAF verifică soții și copiii în întreținere care locuiesc separat. Familia ISEE poate include persoane cu altă adresă.",
    "CAF перевірить подружжя й дітей на утриманні, що живуть окремо. Склад сім’ї ISEE може включати людей за іншою адресою.",
    "يتحقق CAF من الأزواج والأبناء المعالين الذين يعيشون خارج المنزل. قد تضم أسرة ISEE أشخاصًا بعنوان آخر.",
    "CAF আলাদা থাকা স্বামী-স্ত্রী ও নির্ভরশীল সন্তান যাচাই করবে। ISEE পরিবারে অন্য ঠিকানার মানুষও থাকতে পারেন।",
  ],
  "checklist.missing": [
    "Manca: {title}.",
    "Missing: {title}.",
    "Il manque : {title}.",
    "Falta: {title}.",
    "Lipsește: {title}.",
    "Бракує: {title}.",
    "ناقص: {title}.",
    "নেই: {title}।",
  ],
  "checklist.rejected": [
    "Il CAF chiede un nuovo documento: {title}.",
    "The CAF needs a new document: {title}.",
    "Le CAF demande un nouveau document : {title}.",
    "El CAF pide un nuevo documento: {title}.",
    "CAF cere un document nou: {title}.",
    "CAF просить новий документ: {title}.",
    "يطلب CAF وثيقة جديدة: {title}.",
    "CAF নতুন কাগজ চায়: {title}।",
  ],
  "document.expired": [
    "Il documento {file} è scaduto.",
    "The document {file} has expired.",
    "Le document {file} a expiré.",
    "El documento {file} ha caducado.",
    "Documentul {file} a expirat.",
    "Термін документа {file} минув.",
    "انتهت صلاحية الوثيقة {file}.",
    "{file} নথির মেয়াদ শেষ হয়েছে।",
  ],
  "document.expiring": [
    "Il documento {file} scade entro 90 giorni.",
    "The document {file} expires within 90 days.",
    "Le document {file} expire dans 90 jours ou moins.",
    "El documento {file} caduca en 90 días o menos.",
    "Documentul {file} expiră în cel mult 90 de zile.",
    "Документ {file} втратить чинність протягом 90 днів.",
    "تنتهي صلاحية الوثيقة {file} خلال 90 يومًا.",
    "{file} নথির মেয়াদ ৯০ দিনের মধ্যে শেষ হবে।",
  ],
  "document.wrong_year": [
    "{file}: servono dati dell’anno {year}.",
    "{file}: we need details for {year}.",
    "{file} : il faut les données de {year}.",
    "{file}: se necesitan datos de {year}.",
    "{file}: sunt necesare datele din {year}.",
    "{file}: потрібні дані за {year} рік.",
    "{file}: نحتاج بيانات سنة {year}.",
    "{file}: {year} সালের তথ্য দরকার।",
  ],
  "document.wrong_owner": [
    "{file}: l’intestatario non coincide con {owner}. Il CAF deve verificare.",
    "{file}: the owner does not match {owner}. The CAF must check.",
    "{file} : le titulaire ne correspond pas à {owner}. Le CAF doit vérifier.",
    "{file}: el titular no coincide con {owner}. El CAF debe revisar.",
    "{file}: titularul nu corespunde cu {owner}. CAF trebuie să verifice.",
    "{file}: власник не збігається з {owner}. CAF має перевірити.",
    "{file}: الاسم لا يطابق {owner}. يجب أن يتحقق CAF.",
    "{file}: মালিকের নাম {owner}-এর সঙ্গে মেলে না। CAF যাচাই করবে।",
  ],
  "document.illegible": [
    "{file} non è leggibile. Carica una foto o un PDF più chiaro.",
    "{file} is not readable. Upload a clearer photo or PDF.",
    "{file} est illisible. Ajoutez une photo ou un PDF plus clair.",
    "{file} no se puede leer. Sube una foto o PDF más claro.",
    "{file} nu se poate citi. Încarcă o fotografie sau un PDF mai clar.",
    "{file} неможливо прочитати. Завантажте чіткіше фото чи PDF.",
    "{file} غير مقروء. حمّل صورة أو PDF أوضح.",
    "{file} পড়া যাচ্ছে না। আরও পরিষ্কার ছবি বা PDF দিন।",
  ],
  "document.missing_pages": [
    "{file}: mancano alcune pagine. Carica il documento completo.",
    "{file}: some pages are missing. Upload the full document.",
    "{file} : il manque des pages. Ajoutez le document complet.",
    "{file}: faltan páginas. Sube el documento completo.",
    "{file}: lipsesc pagini. Încarcă documentul complet.",
    "{file}: бракує сторінок. Завантажте весь документ.",
    "{file}: بعض الصفحات ناقصة. حمّل الوثيقة كاملة.",
    "{file}: কিছু পাতা নেই। সম্পূর্ণ নথি দিন।",
  ],
  "document.duplicate": [
    "{file} è già presente nel fascicolo.",
    "{file} is already in the dossier.",
    "{file} est déjà dans le dossier.",
    "{file} ya está en el expediente.",
    "{file} există deja în dosar.",
    "{file} уже є у справі.",
    "{file} موجود بالفعل في الملف.",
    "{file} ফাইলে আগে থেকেই আছে।",
  ],
  "document.unmatched": [
    "{file} non è abbinato a una voce. Scegli dove inserirlo o chiedi al CAF.",
    "{file} is not linked to an item. Choose an item or ask the CAF.",
    "{file} n’est pas associé à un élément. Choisissez où le mettre ou demandez au CAF.",
    "{file} no está asociado a un elemento. Elige dónde ponerlo o consulta al CAF.",
    "{file} nu este asociat unei cerințe. Alege unde îl pui sau întreabă CAF.",
    "{file} не прив’язано до пункту. Виберіть пункт або зверніться до CAF.",
    "{file} غير مرتبط ببند. اختر بندًا أو اسأل CAF.",
    "{file} কোনো আইটেমে যুক্ত নেই। কোথায় রাখবেন বেছে নিন বা CAF-এ জিজ্ঞাসা করুন।",
  ],
  "document.other_practice": [
    "{file} sembra appartenere a un’altra voce o pratica. Il CAF deve verificare.",
    "{file} seems to be for another item or service. The CAF must check.",
    "{file} semble concerner un autre élément ou service. Le CAF doit vérifier.",
    "{file} parece de otro elemento o trámite. El CAF debe revisar.",
    "{file} pare pentru altă cerință sau cerere. CAF trebuie să verifice.",
    "{file} схоже стосується іншого пункту чи послуги. CAF має перевірити.",
    "يبدو أن {file} يخص بندًا أو خدمة أخرى. يجب أن يتحقق CAF.",
    "{file} অন্য আইটেম বা সেবার মনে হচ্ছে। CAF যাচাই করবে।",
  ],
  "document.unchecked": [
    "{file}: alcuni dati non sono verificati. L’operatore controllerà il documento.",
    "{file}: some details are not checked. The operator will review the document.",
    "{file} : certaines données ne sont pas vérifiées. L’agent contrôlera le document.",
    "{file}: algunos datos no están verificados. El operador revisará el documento.",
    "{file}: unele date nu sunt verificate. Operatorul va controla documentul.",
    "{file}: деякі дані не перевірені. Оператор перевірить документ.",
    "{file}: بعض البيانات غير مؤكدة. سيراجع الموظف الوثيقة.",
    "{file}: কিছু তথ্য যাচাই হয়নি। অপারেটর নথি পরীক্ষা করবেন।",
  ],
  "document.failed": [
    "Non è stato possibile analizzare {file}. Il CAF deve controllarlo.",
    "We could not check {file}. The CAF must review it.",
    "Impossible d’analyser {file}. Le CAF doit le vérifier.",
    "No se pudo analizar {file}. El CAF debe revisarlo.",
    "Nu am putut analiza {file}. CAF trebuie să îl verifice.",
    "Не вдалося перевірити {file}. CAF має його переглянути.",
    "تعذر تحليل {file}. يجب أن يراجعه CAF.",
    "{file} পরীক্ষা করা যায়নি। CAF দেখবে।",
  ],
  "practice.provisional_year": [
    "Preparazione 2027 basata sulle regole vigenti: il CAF deve verificare modello e istruzioni 2027 prima della presentazione.",
    "Preparation for 2027 follows current rules. The CAF must check the 2027 form and instructions before filing.",
    "La préparation 2027 suit les règles actuelles. Le CAF doit vérifier le formulaire et les consignes 2027 avant l’envoi.",
    "La preparación 2027 sigue las reglas actuales. El CAF debe revisar el formulario e instrucciones 2027 antes de presentar.",
    "Pregătirea pentru 2027 urmează regulile actuale. CAF trebuie să verifice formularul și instrucțiunile 2027 înainte de depunere.",
    "Підготовка до 2027 року за чинними правилами. CAF має перевірити форму та інструкції 2027 року перед поданням.",
    "تجهيز 2027 حسب القواعد الحالية. يجب أن يتحقق CAF من نموذج وتعليمات 2027 قبل التقديم.",
    "২০২৭-এর প্রস্তুতি বর্তমান নিয়ম অনুযায়ী। জমা দেওয়ার আগে CAF ২০২৭-এর ফর্ম ও নির্দেশনা যাচাই করবে।",
  ],
  "practice.parent_review": [
    "Il CAF deve verificare il genitore non convivente: attrazione, componente aggiuntiva o esclusione dipendono dal caso.",
    "The CAF must check the parent living elsewhere. How this parent is included depends on the situation.",
    "Le CAF doit vérifier le parent vivant ailleurs. Son inclusion dépend de la situation.",
    "El CAF debe revisar al progenitor no conviviente. Su inclusión depende del caso.",
    "CAF trebuie să verifice părintele care locuiește separat. Includerea depinde de situație.",
    "CAF має перевірити батька чи матір, що живе окремо. Включення залежить від обставин.",
    "يجب أن يتحقق CAF من الوالد الذي يعيش في مكان آخر. إدراجه يعتمد على الحالة.",
    "আলাদা থাকা বাবা বা মাকে CAF যাচাই করবে। তাঁকে অন্তর্ভুক্ত করা পরিস্থিতির ওপর নির্ভর করে।",
  ],
  "practice.university_review": [
    "Per l’università occorre una verifica specifica del nucleo e dell’autonomia. L’ISEE ordinario da solo può non bastare.",
    "For university, the CAF must check family and independence rules. Ordinary ISEE may not be enough.",
    "Pour l’université, le CAF doit vérifier le foyer et l’autonomie. L’ISEE ordinaire peut ne pas suffire.",
    "Para la universidad, el CAF debe revisar familia y autonomía. El ISEE ordinario puede no bastar.",
    "Pentru universitate, CAF verifică familia și autonomia. ISEE obișnuit poate să nu fie suficient.",
    "Для університету CAF має перевірити склад сім’ї та самостійність. Звичайного ISEE може бути недостатньо.",
    "للجامعة، يتحقق CAF من الأسرة والاستقلال. قد لا يكفي ISEE العادي.",
    "বিশ্ববিদ্যালয়ের জন্য CAF পরিবার ও স্বনির্ভরতার নিয়ম যাচাই করবে। সাধারণ ISEE যথেষ্ট নাও হতে পারে।",
  ],
  "practice.full_dsu": [
    "Questa situazione può richiedere la DSU integrale. Il CAF verifica i moduli necessari.",
    "This situation may need the full DSU. The CAF checks which forms are needed.",
    "Cette situation peut demander la DSU complète. Le CAF vérifie les formulaires nécessaires.",
    "Esta situación puede necesitar la DSU completa. El CAF revisa los formularios necesarios.",
    "Această situație poate cere DSU completă. CAF verifică formularele necesare.",
    "Ця ситуація може вимагати повної DSU. CAF перевірить потрібні форми.",
    "قد تحتاج هذه الحالة إلى DSU كاملة. يتحقق CAF من النماذج المطلوبة.",
    "এই অবস্থায় পূর্ণ DSU লাগতে পারে। CAF দরকারি ফর্ম যাচাই করবে।",
  ],
  "practice.savings_exclusion": [
    "Il CAF verifica l’esclusione fino a 50.000 € complessivi per nucleo di titoli di Stato, buoni fruttiferi e libretti postali ammessi. Non escludere autonomamente altri investimenti.",
    "The CAF checks the household exclusion of up to €50,000 for eligible state bonds and postal savings. Do not remove other investments yourself.",
    "Le CAF vérifie l’exclusion jusqu’à 50 000 € par foyer pour titres d’État et épargne postale admis. N’excluez pas d’autres placements vous-même.",
    "El CAF revisa la exclusión de hasta 50.000 € por familia de deuda pública y ahorro postal admitidos. No excluyas otras inversiones por tu cuenta.",
    "CAF verifică excluderea de până la 50.000 € pe familie pentru titluri de stat și economii poștale eligibile. Nu exclude singur alte investiții.",
    "CAF перевірить виключення до 50 000 € на сім’ю для допустимих державних облігацій та поштових заощаджень. Не виключайте інші інвестиції самостійно.",
    "يتحقق CAF من استثناء حتى 50,000 يورو للأسرة للسندات الحكومية والمدخرات البريدية المؤهلة. لا تستثن استثمارات أخرى بنفسك.",
    "CAF যোগ্য সরকারি বন্ড ও ডাক সঞ্চয়ে পরিবারপিছু সর্বোচ্চ ৫০,০০০ ইউরো বাদ দেওয়ার নিয়ম যাচাই করবে। নিজে অন্য বিনিয়োগ বাদ দেবেন না।",
  ],
  "practice.auu_review": [
    "L’ISEE è facoltativo per l’Assegno unico. Il patronato verifica le regole familiari vigenti, i figli e se una domanda accolta prosegue senza nuova domanda.",
    "ISEE is optional for child allowance. The patronato checks current family rules, the children and whether an accepted application continues.",
    "L’ISEE est facultatif pour l’Assegno unico. Le patronato vérifie les règles, les enfants et la poursuite d’une demande acceptée.",
    "ISEE es opcional para Assegno unico. El patronato revisa las reglas familiares, los hijos y si continúa una solicitud aceptada.",
    "ISEE este opțional pentru Assegno unico. Patronato verifică regulile, copiii și dacă o cerere acceptată continuă.",
    "ISEE необов’язковий для Assegno unico. Patronato перевірить сімейні правила, дітей та продовження схваленої заяви.",
    "ISEE اختياري لـ Assegno unico. يتحقق patronato من القواعد والأطفال واستمرار الطلب المقبول.",
    "Assegno unico-এর জন্য ISEE ঐচ্ছিক। patronato পরিবারের নিয়ম, সন্তান ও মঞ্জুর আবেদন চলবে কি না যাচাই করবে।",
  ],
  "practice.permit_review": [
    "Il patronato verifica motivo, primo rilascio o rinnovo, percorso competente e documenti aggiuntivi. Questa checklist non copre tutti i permessi.",
    "The patronato checks the reason, first permit or renewal, the correct office and extra papers. This checklist does not cover every permit.",
    "Le patronato vérifie le motif, premier titre ou renouvellement, le service compétent et les documents en plus. Cette liste ne couvre pas tous les titres.",
    "El patronato revisa motivo, primer permiso o renovación, vía competente y documentos extra. Esta lista no cubre todos los permisos.",
    "Patronato verifică motivul, primul permis sau reînnoirea, biroul potrivit și actele suplimentare. Lista nu acoperă toate permisele.",
    "Patronato перевірить причину, перший дозвіл чи поновлення, потрібний орган та додаткові документи. Цей список не охоплює всі дозволи.",
    "يتحقق patronato من السبب والإصدار الأول أو التجديد والجهة المختصة والأوراق الإضافية. لا تغطي القائمة جميع التصاريح.",
    "patronato কারণ, প্রথম অনুমতি বা নবায়ন, সঠিক অফিস ও অতিরিক্ত কাগজ যাচাই করবে। এই তালিকা সব অনুমতি অন্তর্ভুক্ত করে না।",
  ],
  "practice.joint_ownership": [
    "Un rapporto o immobile ha più intestatari: il CAF verifica tutti i titolari e le quote.",
    "An account or property has several owners. The CAF checks all owners and shares.",
    "Un compte ou bien a plusieurs titulaires. Le CAF vérifie les titulaires et les parts.",
    "Una cuenta o inmueble tiene varios titulares. El CAF revisa todos los titulares y sus partes.",
    "Un cont sau imobil are mai mulți titulari. CAF verifică titularii și cotele.",
    "Рахунок чи нерухомість має кількох власників. CAF перевірить усіх власників і частки.",
    "للحساب أو العقار عدة أصحاب. يتحقق CAF من الجميع وحصصهم.",
    "হিসাব বা সম্পত্তির একাধিক মালিক আছে। CAF সব মালিক ও অংশ যাচাই করবে।",
  ],
  "practice.outdated_catalog": [
    "Il catalogo è per il 2027. Il CAF deve aggiornare anno e regole prima di usare il fascicolo.",
    "This catalog is for 2027. The CAF must update the year and rules before using the dossier.",
    "Ce catalogue est pour 2027. Le CAF doit mettre à jour l’année et les règles avant utilisation.",
    "Este catálogo es de 2027. El CAF debe actualizar el año y las reglas antes de usar el expediente.",
    "Catalogul este pentru 2027. CAF trebuie să actualizeze anul și regulile înainte de folosire.",
    "Цей каталог для 2027 року. CAF має оновити рік і правила перед використанням справи.",
    "هذا الكتالوج لعام 2027. يجب أن يحدث CAF السنة والقواعد قبل استخدام الملف.",
    "এই ক্যাটালগ ২০২৭-এর। ফাইল ব্যবহারের আগে CAF বছর ও নিয়ম আপডেট করবে।",
  ],
} as const satisfies Record<string, Text>;
type FindingCode = keyof typeof messages;
export type DossierInput = {
  practiceId: PracticeId | null;
  answers: Answers;
  household: Member[];
  checklist: ChecklistItem[];
  documents: DocumentSummary[];
  language: Language;
  now: Date;
  hashes?: Record<string, string>;
};

export function evaluateDossier(input: DossierInput): { findings: Finding[]; progress: Progress } {
  const {
    practiceId,
    answers,
    household,
    checklist,
    documents,
    language,
    now,
    hashes = {},
  } = input;
  const findings: Finding[] = [];
  function finding(
    code: FindingCode,
    severity: Finding["severity"],
    document: DocumentSummary | null = null,
    item: ChecklistItem | null = null,
    vars: Record<string, string | number> = {},
  ) {
    const id = `${code}:${document?.id ?? item?.id ?? "case"}`;
    if (findings.some((existing) => existing.id === id)) return;
    findings.push({
      id,
      severity,
      code,
      message: localize(language, messages[code], {
        file: document?.fileName ?? "",
        title: [item?.title, item?.memberName].filter(Boolean).join(" · "),
        owner: item?.memberName ?? "",
        ...vars,
      }),
      documentId: document?.id ?? null,
      checklistItemId: item?.id ?? null,
      memberId: item?.memberId ?? document?.memberId ?? null,
    });
  }
  const day = calendarDate(now);
  const currentDay = new Date(`${day}T00:00:00Z`).getTime();
  const seenHashes = new Set<string>();
  for (const document of documents) {
    const item = checklist.find((entry) => entry.id === document.checklistItemId) ?? null;
    const member = household.find((entry) => entry.id === item?.memberId);
    const blocking: Finding["severity"] =
      item?.required && !["waived", "verified"].includes(item.status) ? "blocker" : "warning";
    const hash = hashes[document.id];
    if (hash) {
      const scopedHash = `${document.checklistItemId ?? "unmatched"}:${hash}`;
      if (seenHashes.has(scopedHash)) {
        finding("document.duplicate", "warning", document, item);
      } else seenHashes.add(scopedHash);
    }
    if (!item) finding("document.unmatched", "warning", document);
    if (document.status === "failed") finding("document.failed", blocking, document, item);
    const analysis = document.analysis;
    if (!analysis) {
      if (item?.status !== "verified") finding("document.unchecked", "warning", document, item);
      continue;
    }
    if (!analysis.legible && analysis.engine !== "heuristic")
      finding("document.illegible", blocking, document, item);
    if (analysis.pagesComplete === false)
      finding("document.missing_pages", blocking, document, item);
    if (analysis.expiresOn && validDate(analysis.expiresOn)) {
      const days =
        (new Date(`${analysis.expiresOn}T00:00:00Z`).getTime() - currentDay) / 86_400_000;
      if (days < 0) finding("document.expired", blocking, document, item);
      else if (days <= 90) finding("document.expiring", "warning", document, item);
    }
    const requirement = item ? requirements[item.requirementId as RequirementId] : undefined;
    const year = practiceId ? catalog[practiceId].referenceYear : null;
    if (
      year !== null &&
      requirement &&
      (requirement.reference === "assets" || requirement.reference === "income") &&
      analysis.referenceYear !== null &&
      analysis.referenceYear !== year
    )
      finding("document.wrong_year", blocking, document, item, { year });
    if (member && analysis.ownerName && !ownerMatches(analysis.ownerName, member))
      finding("document.wrong_owner", member.lastName ? blocking : "warning", document, item);
    const practiceRequirements = new Set(checklist.map((entry) => entry.requirementId));
    if (
      analysis.detectedRequirementId &&
      ((item && item.requirementId !== analysis.detectedRequirementId) ||
        !practiceRequirements.has(analysis.detectedRequirementId))
    ) {
      const severity =
        analysis.engine === "ai" &&
        analysis.confidence >= 0.75 &&
        !practiceRequirements.has(analysis.detectedRequirementId)
          ? blocking
          : "warning";
      finding("document.other_practice", severity, document, item);
    }
    if (
      analysis.engine === "ai" ||
      analysis.engine === "heuristic" ||
      analysis.confidence < 0.75 ||
      analysis.pagesComplete === null ||
      (analysis.expiresOn !== null && !validDate(analysis.expiresOn)) ||
      (requirement &&
        (requirement.reference === "income" || requirement.reference === "assets") &&
        analysis.referenceYear === null)
    )
      if (item?.status !== "verified") finding("document.unchecked", "warning", document, item);
  }
  let documentsDone = 0;
  const requiredItems = checklist.filter((item) => item.required);
  for (const item of checklist) {
    if (!item.required) continue;
    if (item.status === "waived") {
      documentsDone++;
      continue;
    }
    if (item.status === "rejected") {
      finding("checklist.rejected", "blocker", null, item);
      continue;
    }
    const linked = documents.filter((document) => document.checklistItemId === item.id);
    const usable = linked.some(
      (document) =>
        document.status === "analyzed" &&
        document.analysis !== null &&
        !findings.some((issue) => issue.documentId === document.id && issue.severity === "blocker"),
    );
    if (
      usable ||
      (item.status === "verified" &&
        !findings.some(
          (issue) => issue.checklistItemId === item.id && issue.severity === "blocker",
        ))
    )
      documentsDone++;
    else if (!linked.length) finding("checklist.missing", "blocker", null, item);
  }
  if (practiceId === "isee_ordinario" || practiceId === "modello_730") {
    finding("practice.provisional_year", "warning");
    if (calendarYear(now) > 2027) finding("practice.outdated_catalog", "blocker");
  }
  if (practiceId === "isee_ordinario") {
    if (answers.household_exceptions === true) finding("practice.household_review", "warning");
    if (answers.nonresident_parent === true) finding("practice.parent_review", "warning");
    if (answers.university === true) finding("practice.university_review", "warning");
    if (
      answers.disability === true ||
      answers.university === true ||
      answers.nonresident_parent === true ||
      answers.exempt_income === true
    )
      finding("practice.full_dsu", "warning");
    if (answers.excluded_savings === true) finding("practice.savings_exclusion", "warning");
    if (
      Object.entries(answers).some(
        ([id, value]) => /^(?:account|property)_owner_\d+$/.test(id) && value === "joint",
      )
    )
      finding("practice.joint_ownership", "warning");
  }
  if (practiceId === "assegno_unico") finding("practice.auu_review", "warning");
  if (practiceId === "permesso_soggiorno") finding("practice.permit_review", "warning");
  const questions = practiceId ? getQuestions(practiceId, answers, language) : [];
  const questionsAnswered = questions.filter((question) =>
    Object.hasOwn(answers, question.id),
  ).length;
  let interviewPercent = 0;
  if (questions.length) interviewPercent = questionsAnswered / questions.length;
  else if (practiceId) interviewPercent = 1;
  const documentsPercent = requiredItems.length ? documentsDone / requiredItems.length : 0;
  return {
    findings,
    progress: {
      questionsAnswered,
      questionsTotal: questions.length,
      documentsDone,
      documentsRequired: requiredItems.length,
      percent: Math.round(interviewPercent * 30 + documentsPercent * 70),
    },
  };
}

export function ownerMatches(name: string, member: Member): boolean {
  const fullName = normalizedName([member.firstName, member.lastName].filter(Boolean).join(" "));
  const actual = normalizedName(name);
  if (actual === fullName) return true;
  const expectedTokens = fullName.split(" ");
  const actualTokens = new Set(actual.split(" "));
  const expected = new Set(expectedTokens);
  return (
    expectedTokens.every((token) => actualTokens.has(token)) ||
    (actualTokens.size >= 2 && [...actualTokens].every((token) => expected.has(token)))
  );
}
