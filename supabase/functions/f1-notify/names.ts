// Nomes em português (mesma tabela usada no app).
export const GP_PT: Record<string, string> = {
  "Australian Grand Prix": "GP da Austrália",
  "Chinese Grand Prix": "GP da China",
  "Japanese Grand Prix": "GP do Japão",
  "Bahrain Grand Prix": "GP do Bahrein",
  "Bahrain Grand Prix in Malaysia": "GP do Bahrein (Malásia)",
  "Saudi Arabian Grand Prix": "GP da Arábia Saudita",
  "Miami Grand Prix": "GP de Miami",
  "Emilia Romagna Grand Prix": "GP da Emília-Romanha",
  "Canadian Grand Prix": "GP do Canadá",
  "Monaco Grand Prix": "GP de Mônaco",
  "Barcelona Grand Prix": "GP de Barcelona",
  "Spanish Grand Prix": "GP da Espanha",
  "Austrian Grand Prix": "GP da Áustria",
  "British Grand Prix": "GP da Grã-Bretanha",
  "Belgian Grand Prix": "GP da Bélgica",
  "Hungarian Grand Prix": "GP da Hungria",
  "Dutch Grand Prix": "GP da Holanda",
  "Italian Grand Prix": "GP da Itália",
  "Azerbaijan Grand Prix": "GP do Azerbaijão",
  "Singapore Grand Prix": "GP de Singapura",
  "United States Grand Prix": "GP dos Estados Unidos",
  "Mexico City Grand Prix": "GP do México",
  "Brazilian Grand Prix": "GP de São Paulo",
  "São Paulo Grand Prix": "GP de São Paulo",
  "Las Vegas Grand Prix": "GP de Las Vegas",
  "Qatar Grand Prix": "GP do Catar",
  "Abu Dhabi Grand Prix": "GP de Abu Dhabi",
};
export const gpName = (n: string) => GP_PT[n] ?? "GP " + n.replace(/\s*Grand Prix\s*/i, " ").trim();

export const SESSION_PT: Record<string, string> = {
  FP1: "Treino Livre 1", FP2: "Treino Livre 2", FP3: "Treino Livre 3",
  SQ: "Classificação Sprint", SPRINT: "Sprint", QUALI: "Classificação", RACE: "Corrida",
};

export const spTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d);
export const spDay = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(d);
export const spHour = (d: Date) =>
  +new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(d);
export const spDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // AAAA-MM-DD
