export type IntakeIntent = "need" | "off_topic" | "manipulation" | "emergency";

// Match danger, never a family role alone. Mixed-language stories use all eight lexicons.
const violence =
  /mi picchia|mi sta picchiando|maltratt|violenza|stalking|mi perseguita|mi minaccia|abuse|domestic violence|hits me|hitting me|beats me|beating me|stalk|threaten|me frappe|me bat|violence|harc[eè]l|menace|me pega|me golpea|maltrato|acoso|amenaza|mă bate|ma bate|mă lovește|ma loveste|violență|violenta|hărțui|hartu|ameninț|amenint|б'є|б’є|бити|б'є мене|б’є мене|бʼє|побив|погрож|пересліду|насиль|يضربني|يهددني|عنف|اعتداء|يلاحقني|নির্যাতন|মারধর|মারে|মারছে|হুমকি|পিছু নে/iu;
const danger =
  /emergenz|ho paura|sono in pericolo|aiuto urgente|suicid|uccid|ammazz|non respiro|in danger|afraid|kill myself|kill me|can't breathe|cannot breathe|urgence|en danger|j'ai peur|tuer|ne peux pas respirer|en peligro|tengo miedo|me mat|no puedo respirar|urgență|urgenta|în pericol|in pericol|mi-e frică|mi-e frica|sinucid|nu pot respira|небезпец|небезпек|мені страшно|самогуб|вбити|не можу дихати|خطر|خائفة|خائف|طوارئ|انتحار|أقتل|لا أستطيع التنفس|বিপদ|ভয়|আত্মহত্যা|শ্বাস নিতে পারছি না/iu;

export function intakeEmergency(text: string): boolean {
  return violence.test(text.normalize("NFKC")) || danger.test(text.normalize("NFKC"));
}
export function intakeViolence(text: string): boolean {
  return violence.test(text.normalize("NFKC"));
}
export function localIntakeIntent(text: string, hasNeed: boolean): IntakeIntent {
  if (intakeEmergency(text)) return "emergency";
  if (
    /ignor(?:a|e|ă|ez).{0,40}(?:istruzion|instruction|regul|regl)|(?:system|developer)\s*:|rivela.{0,30}(?:prompt|segre|password)|reveal.{0,30}(?:prompt|secret|password)|sono l.amministratore|ignorez|ignora.{0,30}instrucciones|تجاهل|ігноруй|উপেক্ষা/iu.test(
      text,
    )
  )
    return "manipulation";
  return hasNeed ? "need" : "off_topic";
}
