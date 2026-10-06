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
    "{file}: l’intestatario non coincide con {owner}. Il CAF deve verificare. Controlla a chi hai abbinato il file oppure carica il documento corretto.",
    "{file}: the owner does not match {owner}. The CAF must check. Check who you assigned the file to or upload the correct document.",
    "{file} : le titulaire ne correspond pas à {owner}. Le CAF doit vérifier. Vérifiez la personne associée au fichier ou envoyez le bon document.",
    "{file}: el titular no coincide con {owner}. El CAF debe revisar. Comprueba a quién has asignado el archivo o sube el documento correcto.",
    "{file}: titularul nu corespunde cu {owner}. CAF trebuie să verifice. Verifică persoana asociată fișierului sau încarcă documentul corect.",
    "{file}: власник не збігається з {owner}. CAF має перевірити. Перевірте, кому призначено файл, або завантажте правильний документ.",
    "{file}: الاسم لا يطابق {owner}. يجب أن يتحقق CAF. تحقق من الشخص المرتبط بالملف أو ارفع المستند الصحيح.",
    "{file}: মালিকের নাম {owner}-এর সঙ্গে মেলে না। CAF যাচাই করবে। ফাইলটি কার সঙ্গে যুক্ত করেছেন দেখুন অথবা সঠিক নথি আপলোড করুন।",
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
    "{file} sembra appartenere a un’altra voce o pratica. Il CAF deve verificare. Abbinalo alla voce corretta oppure carica il documento richiesto.",
    "{file} seems to be for another item or service. The CAF must check. Assign it to the correct item or upload the requested document.",
    "{file} semble concerner un autre élément ou service. Le CAF doit vérifier. Associez-le au bon élément ou envoyez le document demandé.",
    "{file} parece de otro elemento o trámite. El CAF debe revisar. Asígnalo al elemento correcto o sube el documento solicitado.",
    "{file} pare pentru altă cerință sau cerere. CAF trebuie să verifice. Asociază-l cerinței corecte sau încarcă documentul solicitat.",
    "{file} схоже стосується іншого пункту чи послуги. CAF має перевірити. Призначте його правильному пункту або завантажте потрібний документ.",
    "يبدو أن {file} يخص بندًا أو خدمة أخرى. يجب أن يتحقق CAF. اربطه بالبند الصحيح أو ارفع المستند المطلوب.",
    "{file} অন্য আইটেম বা সেবার মনে হচ্ছে। CAF যাচাই করবে। সঠিক আইটেমের সঙ্গে যুক্ত করুন অথবা প্রয়োজনীয় নথি আপলোড করুন।",
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
    "Non è stato possibile analizzare {file}. Il CAF deve controllarlo. Puoi caricare una nuova copia più chiara.",
    "We could not check {file}. The CAF must review it. You can upload a clearer copy.",
    "Impossible d’analyser {file}. Le CAF doit le vérifier. Vous pouvez envoyer une copie plus nette.",
    "No se pudo analizar {file}. El CAF debe revisarlo. Puedes subir una copia más clara.",
    "Nu am putut analiza {file}. CAF trebuie să îl verifice. Poți încărca o copie mai clară.",
    "Не вдалося перевірити {file}. CAF має його переглянути. Можете завантажити чіткішу копію.",
    "تعذر تحليل {file}. يجب أن يراجعه CAF. يمكنك رفع نسخة أوضح.",
    "{file} পরীক্ষা করা যায়নি। CAF দেখবে। আরও পরিষ্কার একটি কপি আপলোড করতে পারেন।",
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
    "Per prestazioni universitarie il CAF completa il quadro C MB.2 e verifica genitori non conviventi, autonomia dello studente e dottorato (possibile nucleo ristretto). Il solo ISEE ordinario non sostituisce l’ISEE Università.",
    "For university support, the CAF completes MB.2 section C and checks parents living elsewhere, student independence and PhD rules (a smaller household may apply). Ordinary ISEE alone does not replace university ISEE.",
    "Pour les aides universitaires, le CAF complète le cadre C MB.2 et vérifie les parents non cohabitants, l’autonomie et le doctorat (foyer restreint possible). L’ISEE ordinaire seul ne remplace pas l’ISEE Université.",
    "Para ayudas universitarias, el CAF completa el cuadro C MB.2 y revisa progenitores no convivientes, autonomía y doctorado (posible núcleo reducido). El ISEE ordinario solo no sustituye al ISEE Universidad.",
    "Pentru sprijin universitar, CAF completează cadrul C MB.2 și verifică părinții care locuiesc separat, autonomia și doctoratul (posibil nucleu restrâns). ISEE obișnuit singur nu înlocuiește ISEE Universitate.",
    "Для університетської допомоги CAF заповнює розділ C MB.2 і перевіряє батьків, які живуть окремо, самостійність і докторантуру (можлива менша сім’я). Звичайний ISEE не замінює університетський.",
    "للدعم الجامعي، يكمل CAF القسم C من MB.2 ويتحقق من الوالدين غير المقيمين والاستقلال والدكتوراه (قد تُعتمد أسرة أصغر). ISEE العادي وحده لا يحل محل ISEE الجامعي.",
    "বিশ্ববিদ্যালয়ের সহায়তার জন্য CAF MB.2-এর C অংশ পূরণ করবে এবং আলাদা থাকা বাবা-মা, স্বনির্ভরতা ও ডক্টরেটের নিয়ম (ছোট পরিবার সম্ভব) যাচাই করবে। সাধারণ ISEE একা বিশ্ববিদ্যালয়ের ISEE-এর বিকল্প নয়।",
  ],
  "practice.foreign_institution_review": [
    "Il CAF verifica dove è detenuto il rapporto finanziario e se occorrono documenti per patrimoni esteri. Il nome della banca o del wallet non prova il paese né il tipo di rapporto.",
    "The CAF checks where the financial account is held and whether foreign asset documents are needed. A bank or wallet name does not prove the country or account type.",
    "Le CAF vérifie le pays du compte et les documents pour les biens à l’étranger. Le nom de la banque ou du portefeuille ne prouve ni le pays ni le type de compte.",
    "El CAF revisa el país de la cuenta y los documentos de bienes en el extranjero. El nombre del banco o monedero no prueba el país ni el tipo de cuenta.",
    "CAF verifică țara contului și documentele pentru bunuri din străinătate. Numele băncii sau portofelului nu dovedește țara ori tipul contului.",
    "CAF перевіряє країну рахунку та документи для закордонних активів. Назва банку чи гаманця не визначає країну або тип рахунку.",
    "يتحقق CAF من بلد الحساب ومستندات الأصول في الخارج. اسم البنك أو المحفظة لا يثبت البلد أو نوع الحساب.",
    "CAF হিসাবের দেশ ও বিদেশি সম্পদের নথি যাচাই করবে। ব্যাংক বা ওয়ালেটের নাম দেশ বা হিসাবের ধরন প্রমাণ করে না।",
  ],
  "practice.mortgage_review": [
    "È stato indicato un mutuo sulla casa. Il CAF verifica proprietà, acquisto/costruzione e capitale residuo al 31 dicembre 2025; il racconto non conferma il residuo a quella data.",
    "A home mortgage was mentioned. The CAF checks ownership, purchase/building purpose and outstanding principal on 31 December 2025; the story does not confirm the balance on that date.",
    "Un prêt immobilier a été mentionné. Le CAF vérifie la propriété, l’achat/construction et le capital restant au 31 décembre 2025 ; le récit ne confirme pas le solde à cette date.",
    "Se ha indicado una hipoteca. El CAF verifica propiedad, compra/construcción y capital pendiente al 31 de diciembre de 2025; el relato no confirma el saldo de esa fecha.",
    "A fost indicat un credit ipotecar. CAF verifică proprietatea, achiziția/construcția și capitalul restant la 31 decembrie 2025; relatarea nu confirmă soldul de atunci.",
    "Згадано іпотеку. CAF перевіряє власність, придбання/будівництво та залишок основної суми на 31 грудня 2025 року; розповідь не підтверджує залишок на цю дату.",
    "ذُكر رهن على المنزل. يتحقق CAF من الملكية والشراء أو البناء وأصل الدين المتبقي في 31 ديسمبر 2025؛ القصة لا تؤكد الرصيد في ذلك التاريخ.",
    "বাড়ির ঋণের কথা বলা হয়েছে। CAF মালিকানা, কেনা/নির্মাণ ও ৩১ ডিসেম্বর ২০২৫-এর বাকি মূলধন যাচাই করবে; বর্ণনা সেই তারিখের বকেয়া নিশ্চিত করে না।",
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
    if (answers.foreign_institution_review === true)
      finding("practice.foreign_institution_review", "warning");
    if (answers.mortgage_review === true) finding("practice.mortgage_review", "warning");
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
    [...actualTokens].every((token) => expected.has(token))
  );
}
