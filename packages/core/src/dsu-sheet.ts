import type {
  ChecklistItem,
  DocumentSummary,
  DsuRow,
  DsuSection,
  DsuSheet,
  Member,
  PracticeId,
} from "@avanti/contracts";
import { boundedCount, catalog, type Answers } from "./catalog";
import type { RequirementId } from "./requirements";

export function formatDsuDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    return null;
  return `${day}/${month}/${year}`;
}

export function formatDsuAmount(value: number): string | null {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 100) return null;
  return value.toFixed(2).replace(".", ",");
}

const titles: Record<DsuSection["quadro"], string> = {
  A: "Nucleo familiare",
  B: "Casa di abitazione",
  FC1: "Dati del componente",
  FC2: "Patrimonio mobiliare",
  FC3: "Patrimonio immobiliare",
  FC4: "Redditi e trattamenti da dichiarare a fini ISEE",
  FC5: "Assegni periodici per coniuge e figli",
  FC6: "Autoveicoli e altri beni durevoli",
  FC7: "Disabilità e non autosufficienza",
  FC8: "Redditi, trattamenti e spese da dichiarare solo in casi eccezionali",
};
const missing = (label: string, note?: string): DsuRow => ({
  label,
  value: null,
  source: { kind: "missing" },
  ...(note ? { note } : {}),
});
const caf = (label: string, note: string): DsuRow => ({
  label,
  value: null,
  source: { kind: "caf" },
  note,
});
const answer = (label: string, value: string, questionId: string, note?: string): DsuRow => ({
  label,
  value,
  source: { kind: "answer", questionId },
  ...(note ? { note } : {}),
});
const exclusionQuestions: Partial<Record<RequirementId, string>> = {
  business: "self_employed",
  disability: "disability",
  exempt_income: "exempt_income",
  foreign_income: "foreign_income",
  foreign_assets: "foreign_assets",
  maintenance: "maintenance",
  excluded_savings: "excluded_savings",
  property: "properties_count",
};

export function buildDsuSheet(
  practiceId: PracticeId | null,
  answers: Answers,
  household: Member[],
  checklist: ChecklistItem[],
  documents: DocumentSummary[],
): DsuSheet | null {
  if (practiceId !== "isee_ordinario") return null;
  const referenceYear = catalog.isee_ordinario.referenceYear!;
  const sections: DsuSection[] = [];
  const orderedDocuments = [...documents].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const people = [
    ...household.filter((m) => m.role === "richiedente"),
    ...household.filter((m) => m.role !== "richiedente"),
  ];
  const name = (member: Member) => [member.firstName, member.lastName].filter(Boolean).join(" ");
  function section(
    quadro: DsuSection["quadro"],
    rows: DsuRow[],
    member: Member | null = null,
    instanceId: string | null = null,
  ) {
    const notes = rows.flatMap((row) => (row.note ? [row.note] : []));
    const sharedNotes = [...new Set(notes)].filter(
      (note) => notes.filter((candidate) => candidate === note).length > 1,
    );
    sections.push({
      module:
        quadro === "A" || quadro === "B"
          ? "MB.1"
          : quadro === "FC7"
            ? "FC.2"
            : quadro === "FC8"
              ? "FC.3"
              : "FC.1",
      quadro,
      title: titles[quadro],
      memberId: member?.id ?? null,
      memberName: member ? name(member) : null,
      instanceId,
      ...(sharedNotes.length ? { note: sharedNotes.join(" ") } : {}),
      rows: rows.map((row) => {
        if (!row.note || !sharedNotes.includes(row.note)) return row;
        const { note: _note, ...field } = row;
        return field;
      }),
    });
  }
  function excluded(label: string, questionId: string): DsuRow | null {
    const value = answers[questionId];
    return (questionId.endsWith("_count") ? value === 0 : value === false)
      ? answer(label, "Nessuno", questionId)
      : null;
  }
  function fromDocument(
    label: string,
    requirementId: RequirementId,
    member: Member | null = null,
    key?: string,
    exclusionQuestionId = exclusionQuestions[requirementId],
  ): DsuRow {
    const absence = exclusionQuestionId ? excluded(label, exclusionQuestionId) : null;
    if (absence) return absence;
    const item = checklist.find(
      (i) =>
        i.requirementId === requirementId &&
        i.memberId === (member?.id ?? null) &&
        (!key || i.id === `${requirementId}:${key}`),
    );
    const document =
      item?.status === "verified"
        ? orderedDocuments.find(
            (d) =>
              d.status === "analyzed" &&
              d.checklistItemId === item.id &&
              item.documentIds.includes(d.id) &&
              (d.memberId === null || d.memberId === item.memberId),
          )
        : undefined;
    return document && item
      ? {
          label,
          value: null,
          source: { kind: "document", documentId: document.id, checklistItemId: item.id },
        }
      : {
          label,
          value: null,
          source: { kind: "missing", ...(item ? { checklistItemId: item.id } : {}) },
          ...(item && item.status !== "missing"
            ? { note: "Verificare il documento prima di usare il dato." }
            : {}),
        };
  }
  function flag(label: string, questionId: string, note: string): DsuRow {
    const value = answers[questionId];
    return typeof value === "boolean"
      ? answer(label, value ? "Sì" : "No", questionId, note)
      : { ...missing(label, note), source: { kind: "missing", questionId } };
  }
  function identity(member: Member): DsuRow[] {
    return [
      member.lastName
        ? answer("Cognome", member.lastName.trim(), "members")
        : fromDocument("Cognome", "identity", member),
      answer("Nome", member.firstName.trim(), "members"),
      fromDocument("Codice fiscale", "tax_code", member),
    ];
  }
  if (!people.length)
    section("A", [missing("Composizione del nucleo familiare", "Nucleo non ancora identificato.")]);
  for (const member of people)
    section(
      "A",
      [
        ...identity(member),
        fromDocument("Data di nascita", "identity", member),
        fromDocument("Comune o Stato estero di nascita", "identity", member),
        fromDocument("Sesso", "identity", member),
        caf(
          "Assenza di redditi, trattamenti e patrimoni del minore",
          "L'assenza di redditi dichiarata nell'intervista non prova l'assenza di patrimoni; verificare anche l'età esatta.",
        ),
      ],
      member,
    );
  section("A", [
    caf(
      "Attività di lavoro o impresa dei genitori per almeno sei mesi",
      "Informazione non raccolta.",
    ),
    caf("Genitore solo con figli minorenni", "Composizione e condizioni legali da verificare."),
    caf("Numero di figli, di cui conviventi", "Non ricavabile dal solo elenco dei conviventi."),
    flag(
      "Nucleo da verificare (supporto Avanti)",
      "household_exceptions",
      "Non è una casella ufficiale: il CAF determina il nucleo legale.",
    ),
  ]);
  const housing = {
    rent: "IN LOCAZIONE",
    owned: "DI PROPRIETÀ (O ALTRO DIRITTO REALE DI GODIMENTO)",
    hosted: "ALTRO (ES. COMODATO GRATUITO)",
  };
  const housingValue =
    typeof answers.housing === "string" && Object.hasOwn(housing, answers.housing)
      ? housing[answers.housing as keyof typeof housing]
      : null;
  section("B", [
    ...["Via", "Numero civico", "CAP", "Comune", "Provincia"].map((label) =>
      answers.housing === "rent" ? fromDocument(label, "rent") : missing(label),
    ),
    housingValue
      ? answer("Casa di abitazione", housingValue, "housing")
      : missing("Casa di abitazione"),
    ...(answers.housing === "rent"
      ? [
          ...[
            "Codice fiscale degli intestatari del contratto",
            "Data di registrazione",
            "Serie",
            "Numero di registrazione",
            "Codice ufficio",
          ].map((label) => fromDocument(label, "rent")),
          fromDocument("Canone annuale della locazione previsto dal contratto", "rent"),
        ]
      : []),
    caf(
      "Coniugi con diversa residenza: residenza familiare di riferimento",
      "Scelta del dichiarante/coniuge da confermare al CAF.",
    ),
  ]);

  function assets(member: Member | null) {
    for (let index = 0; index < boundedCount(answers.accounts_count); index++) {
      const ownerId = answers[`account_owner_${index}`];
      const owner = household.find((m) => m.id === ownerId) ?? null;
      if ((owner?.id ?? null) !== (member?.id ?? null)) continue;
      const key = `account_${index}_${owner?.id ?? "joint"}`;
      const type = answers[`account_type_${index}`];
      const requirement = type === "investment" ? "investment" : "account_balance";
      const bank = answers[`account_bank_${index}`];
      section(
        "FC2",
        [
          typeof ownerId === "string"
            ? answer(
                "Intestatario (supporto Avanti)",
                owner ? name(owner) : ownerId === "joint" ? "Co-intestato" : "Da verificare",
                `account_owner_${index}`,
                "Verificare intestatari e quote sul documento.",
              )
            : missing("Intestatario (supporto Avanti)"),
          caf(
            "Tipo rapporto",
            "La scelta depositi/investimenti/altro non determina il codice DSU: Sez. I 01/03/09; Sez. II consultare le istruzioni.",
          ),
          ...(typeof bank === "string" && bank.trim()
            ? [
                answer(
                  "Istituto (supporto Avanti)",
                  bank.trim(),
                  `account_bank_${index}`,
                  "Il nome dell'istituto non è il suo codice fiscale.",
                ),
              ]
            : []),
          ...[
            "Identificativo rapporto",
            "Codice fiscale dell'operatore finanziario",
            "Data inizio",
            "Data fine",
          ].map((label) => fromDocument(label, requirement, owner, key)),
          ...(type === "investment"
            ? [fromDocument("Valore", requirement, owner, key)]
            : [
                fromDocument("Saldo al 31 dicembre", requirement, owner, key),
                ...(type !== "other"
                  ? [fromDocument("Giacenza media", "account_average", owner, key)]
                  : []),
              ]),
          caf(
            "Quota di titolarità (supporto Avanti)",
            "Verificare quote e co-intestazioni; nessuna ripartizione automatica.",
          ),
        ],
        member,
        `account_${index}`,
      );
    }
    for (let index = 0; index < boundedCount(answers.properties_count); index++) {
      const owner = household.find((m) => m.id === answers[`property_owner_${index}`]) ?? null;
      if ((owner?.id ?? null) !== (member?.id ?? null)) continue;
      const key = `property_${index}_${owner?.id ?? "joint"}`;
      const label = answers[`property_label_${index}`];
      section(
        "FC3",
        [
          typeof answers[`property_owner_${index}`] === "string"
            ? answer(
                "Intestatario (supporto Avanti)",
                owner ? name(owner) : "Co-intestazione o titolarità da verificare",
                `property_owner_${index}`,
              )
            : missing("Intestatario (supporto Avanti)"),
          ...(typeof label === "string" && label.trim()
            ? [
                answer(
                  "Descrizione immobile (supporto Avanti)",
                  label.trim(),
                  `property_label_${index}`,
                  "Non equivale a Comune, tipo o identificativo catastale.",
                ),
              ]
            : []),
          ...[
            "Tipo di patrimonio",
            "Situato nel Comune o Stato estero",
            "Quota posseduta (%)",
            "Valore ai fini IMU/IVIE della quota posseduta",
          ].map((field) => fromDocument(field, "property", owner, key)),
          fromDocument(
            "Quota capitale residua del mutuo della quota posseduta",
            "mortgage",
            owner,
            key,
            `property_mortgage_${index}`,
          ),
          caf(
            "Casa di abitazione",
            "Verificare la corrispondenza con il quadro B; tipi F/TE/TA da verificare sul documento.",
          ),
        ],
        member,
        `property_${index}`,
      );
    }
    for (let index = 0; index < boundedCount(answers.vehicles_count); index++) {
      const owner = household.find((m) => m.id === answers[`vehicle_owner_${index}`]) ?? null;
      if ((owner?.id ?? null) !== (member?.id ?? null)) continue;
      const key = `vehicle_${index}_${owner?.id ?? "unknown"}`;
      const label = answers[`vehicle_label_${index}`];
      section(
        "FC6",
        [
          owner
            ? answer("Intestatario (supporto Avanti)", name(owner), `vehicle_owner_${index}`)
            : missing("Intestatario (supporto Avanti)"),
          ...(typeof label === "string" && label.trim()
            ? [
                answer(
                  "Descrizione mezzo (supporto Avanti)",
                  label.trim(),
                  `vehicle_label_${index}`,
                  "Non equivale a tipo DSU o targa.",
                ),
              ]
            : []),
          fromDocument("Tipo", "vehicle", owner, key),
          fromDocument("Targa veicolo o estremi registrazione", "vehicle", owner, key),
        ],
        member,
        `vehicle_${index}`,
      );
    }
  }
  const uniqueApplicant = people.filter((m) => m.role === "richiedente").length === 1;
  for (const member of people) {
    const relation = uniqueApplicant
      ? ({ richiedente: "D", coniuge: "C", genitore: "P", altro: "P", figlio: null } as const)[
          member.role
        ]
      : undefined;
    section(
      "FC1",
      [
        ...identity(member),
        relation
          ? answer(
              "Relazione con il dichiarante",
              relation,
              "members",
              "Il richiedente è proposto come dichiarante; il CAF conferma il ruolo e il nucleo.",
            )
          : caf(
              "Relazione con il dichiarante",
              "Per i figli verificare F/FC/FNC/MA, età esatta e convivenza; non basta l'anno di nascita.",
            ),
        fromDocument("Cittadinanza", "identity", member),
        ...[
          "Residenza diversa dal quadro B: via",
          "Numero civico",
          "CAP",
          "Comune",
          "Provincia",
          "Telefono (facoltativo)",
          "E-mail (facoltativa)",
          "Convivenza anagrafica",
          "Attività lavorativa",
        ].map((label) => missing(label)),
        flag(
          "Redditi o trattamenti presenti (supporto Avanti)",
          `income_present_${member.id}`,
          "Non è un importo FC4/FC8 e non prova l'assenza di patrimoni.",
        ),
        ...(member.birthYear
          ? [
              answer(
                "Anno di nascita (supporto Avanti)",
                String(member.birthYear),
                "members",
                "Non compilare la data di nascita con il solo anno.",
              ),
            ]
          : []),
      ],
      member,
    );
    assets(member);
    section(
      "FC2",
      [
        ...(answers.accounts_count === 0
          ? [answer("Rapporti finanziari", "Nessuno", "accounts_count")]
          : []),
        ...(answers.accounts_count !== 0 &&
        !sections.some((s) => s.quadro === "FC2" && s.memberId === member.id)
          ? [
              missing(
                "Identificativo rapporto",
                "Nessun rapporto attribuito al componente; verificare anche quelli cointestati o esteri.",
              ),
              missing("Saldo al 31 dicembre"),
              missing("Giacenza media"),
              missing("Valore"),
            ]
          : []),
        ...["Totale saldo (A)", "Totale giacenza (B)", "Differenza (A-B)"].map((label) =>
          caf(
            label,
            "Da documenti e/o precompilato INPS/AdE; verificare rapporti chiusi, quote ed esclusioni.",
          ),
        ),
        ...[
          "Incremento patrimonio almeno pari alla differenza tra giacenza e saldo",
          "Incremento patrimonio immobiliare (C)",
          "Incremento patrimonio mobiliare (D)",
          "Totale (C+D)",
        ].map((label) => caf(label, "Condizione e importi non raccolti; verifica CAF.")),
        fromDocument("Partecipazioni e patrimonio netto d'impresa", "business", member),
      ],
      member,
    );
    if (!sections.some((s) => s.quadro === "FC3" && s.memberId === member.id))
      section(
        "FC3",
        [
          ...(answers.properties_count === 0
            ? [answer("Immobili e terreni", "Nessuno", "properties_count")]
            : [
                "Tipo di patrimonio",
                "Situato nel Comune o Stato estero",
                "Quota posseduta (%)",
                "Valore ai fini IMU/IVIE della quota posseduta",
                "Quota capitale residua del mutuo della quota posseduta",
                "Casa di abitazione",
              ].map((label) =>
                missing(
                  label,
                  "Nessun immobile attribuito al componente; non equivale ad assenza dichiarata.",
                ),
              )),
        ],
        member,
      );
    section(
      "FC4",
      [
        fromDocument(
          "Redditi assoggettati ad imposta sostitutiva o ritenuta a titolo d'imposta",
          "exempt_income",
          member,
        ),
        fromDocument(
          "Redditi esenti da imposta (esclusi trattamenti INPS)",
          "exempt_income",
          member,
        ),
        fromDocument("Proventi agrari ai fini IRAP", "business", member),
        fromDocument("Redditi fondiari di beni non locati soggetti a IMU", "property", member),
        fromDocument(
          "Trattamenti non IRPEF e non INPS, esclusi quelli per disabilità",
          "exempt_income",
          member,
        ),
        ...[
          "Redditi da lavoro o pensione tassati esclusivamente all'estero",
          "Reddito lordo dei residenti AIRE nel paese di residenza",
        ].map((label) => fromDocument(label, "foreign_income", member)),
        excluded("Redditi fondiari esteri non locati soggetti a IVIE", "foreign_assets") ??
          excluded("Redditi fondiari esteri non locati soggetti a IVIE", "properties_count") ??
          fromDocument(
            "Redditi fondiari esteri non locati soggetti a IVIE",
            "foreign_income",
            member,
          ),
      ],
      member,
    );
    section(
      "FC5",
      [
        ...[
          "Assegni percepiti per il mantenimento di figli",
          "Assegni corrisposti al coniuge, compresi quelli per i figli, dopo separazione o scioglimento",
          "Assegni corrisposti per figli conviventi con l'altro genitore",
        ].map((label) => fromDocument(label, "maintenance", member)),
      ],
      member,
    );
    if (!sections.some((s) => s.quadro === "FC6" && s.memberId === member.id))
      section(
        "FC6",
        answers.vehicles_count === 0
          ? [answer("Autoveicoli e altri beni durevoli", "Nessuno", "vehicles_count")]
          : [
              missing(
                "Tipo",
                "Nessun mezzo attribuito a questo componente; non equivale a una dichiarazione di assenza.",
              ),
              missing("Targa veicolo o estremi registrazione"),
            ],
        member,
      );
    section(
      "FC7",
      answers.disability === false
        ? [answer("Disabilità e non autosufficienza", "Nessuno", "disability")]
        : [
            ...[
              "Disabilità media, grave o non autosufficienza",
              "Ente certificatore",
              "Numero documento",
              "Data della certificazione",
            ].map((label) => fromDocument(label, "disability", member)),
            caf(
              "Prestazioni socio-sanitarie in ambiente residenziale",
              "Non raccolto; se pertinente serve anche MB.3. FC7 appartiene al modello integrale.",
            ),
          ],
      member,
    );
    section(
      "FC8",
      [
        caf(
          "Reddito complessivo ai fini IRPEF",
          "Acquisizione INPS/AdE a cura del CAF; eventuale esonero senza CU richiede valutazione FC8.",
        ),
        caf(
          "Redditi da lavoro dipendente, pensione e altri redditi",
          "Dati INPS/AdE, non ricavati dalla dichiarazione di presenza di redditi.",
        ),
        caf(
          "Trattamenti erogati da INPS e spese",
          "Acquisizione e verifica a cura del CAF; nessun collegamento agli archivi da Avanti.",
        ),
      ],
      member,
    );
  }
  assets(null);
  section("FC2", [
    ...(typeof answers.excluded_savings === "boolean" || boundedCount(answers.accounts_count) > 0
      ? [
          fromDocument(
            "Titoli di Stato, buoni e libretti postali (supporto Avanti)",
            "excluded_savings",
          ),
          ...(answers.excluded_savings === true
            ? [
                caf(
                  "Applicazione esclusione fino a 50.000 euro per nucleo",
                  "Ripartizione da verificare con il CAF, senza sottrazioni automatiche.",
                ),
              ]
            : []),
        ]
      : []),
    fromDocument("Patrimoni esteri (supporto Avanti)", "foreign_assets"),
  ]);
  const order: DsuSection["quadro"][] = [
    "A",
    "B",
    "FC1",
    "FC2",
    "FC3",
    "FC4",
    "FC5",
    "FC6",
    "FC7",
    "FC8",
  ];
  sections.sort((a, b) => {
    const aBase = a.quadro === "A" || a.quadro === "B";
    const bBase = b.quadro === "A" || b.quadro === "B";
    if (aBase || bBase)
      return aBase && bBase ? order.indexOf(a.quadro) - order.indexOf(b.quadro) : aBase ? -1 : 1;
    const position = (id: string | null) =>
      id === null ? people.length : people.findIndex((m) => m.id === id);
    return (
      position(a.memberId) - position(b.memberId) ||
      order.indexOf(a.quadro) - order.indexOf(b.quadro)
    );
  });
  return {
    version: 1,
    practiceId,
    modelYear: 2026,
    modelUrl: "https://www.lavoro.gov.it/strumenti-e-servizi/isee-dsu-2026",
    declarationYear: referenceYear + 2,
    referenceYear,
    notes: [
      "Prospetto preparatorio, non DSU ufficiale. Modello verificato 2026; modello 2027 non verificato. Ricontrollare prima del pilota.",
      `Redditi e giacenza media: ${referenceYear}; patrimoni: ${formatDsuDate(`${referenceYear}-12-31`)}. Nucleo, casa e veicoli: alla presentazione.`,
      "Valori documentali non estratti. Date: gg/mm/aaaa; importi: due decimali con virgola, senza calcoli ISEE o arrotondamenti fiscali automatici.",
      "Nessuno: voce esclusa dal cittadino nell'intervista, da confermare al CAF. Dati mancanti: acquisire; documenti verificati: leggere il campo.",
      "Le risposte sono dichiarazioni da confermare. Beni senza componente: verificare titolarità e co-intestazione, senza duplicare beni o attribuire quote.",
      "La Mini contiene A/B e FC1-FC6. FC7 e FC8 sono integrazioni; C/D/E, nucleo ristretto, FC9 e ISEE corrente richiedono percorsi specifici del CAF.",
    ],
    sections,
  };
}
