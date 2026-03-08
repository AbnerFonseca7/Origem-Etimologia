import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface EtymologyData {
  word: string;
  origin: string;
  history: string;
  meaning: string;
  card_summary: string;
  related_words: string[];
  fun_fact: string;
  pronunciation?: string;
  observations?: string;
  consensus_level: "alto" | "médio" | "debatido";
  created_at?: string;
  access_count?: number;
  isFirstSearch?: boolean;
}

export interface EtymologySense {
  id: string;
  label: string;
  description: string;
}

export interface EtymologyResponse {
  type: "result" | "disambiguation";
  data?: EtymologyData;
  senses?: EtymologySense[];
}

export async function fetchEtymology(word: string): Promise<EtymologyResponse> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analise a palavra "${word}". Se ela for um homônimo com origens diferentes (ex: manga fruta vs manga camisa) ou tiver sentidos muito distintos, retorne uma lista de opções para desambiguação. Caso contrário, forneça a etimologia completa.`,
    config: {
      systemInstruction: `Você é um assistente especializado em etimologia. 
      
      Sua tarefa é identificar se uma palavra é ambígua (homônimos ou polissemias distantes).
      
      CASO A PALAVRA SEJA AMBÍGUA:
      Retorne o tipo "disambiguation" com uma lista de "senses". Cada sense deve ter um label curto (ex: "Fruta") e uma description breve (ex: "Refere-se ao fruto da mangueira").
      
      CASO A PALAVRA SEJA CLARA OU O USUÁRIO JÁ FORNECEU CONTEXTO (ex: "manga de camisa"):
      Retorne o tipo "result" com os dados completos da etimologia no campo "data".
      
      Regras de Etimologia:
      1) Não inventar fontes.
      2) Indicar divergências.
      3) Usar termos técnicos de filologia.
      4) Realizar verificação interna silenciosa para evitar etimologias populares.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["result", "disambiguation"] },
          senses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["id", "label", "description"]
            }
          },
          data: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              origin: { type: Type.STRING },
              history: { type: Type.STRING },
              meaning: { type: Type.STRING },
              card_summary: { type: Type.STRING },
              related_words: { type: Type.ARRAY, items: { type: Type.STRING } },
              fun_fact: { type: Type.STRING },
              pronunciation: { type: Type.STRING },
              observations: { type: Type.STRING },
              consensus_level: { type: Type.STRING, enum: ["alto", "médio", "debatido"] }
            },
            required: ["word", "origin", "history", "meaning", "card_summary", "related_words", "fun_fact", "consensus_level"]
          }
        },
        required: ["type"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as EtymologyResponse;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Não foi possível processar a etimologia desta palavra.");
  }
}

export async function fetchWordOfTheDay(): Promise<EtymologyData> {
  // We can use a fixed seed or just ask for a "word of the day"
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Escolha uma palavra fascinante da língua portuguesa para ser a 'Palavra do Dia' e forneça sua etimologia completa.",
    config: {
      systemInstruction: "Você é um etimologista especializado. Escolha palavras com histórias ricas e siga as regras de rigor acadêmico, incluindo a verificação interna silenciosa (Regra 12) para garantir precisão técnica e honestidade sobre divergências.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          origin: { type: Type.STRING },
          history: { type: Type.STRING },
          meaning: { type: Type.STRING },
          card_summary: { type: Type.STRING },
          related_words: { type: Type.ARRAY, items: { type: Type.STRING } },
          fun_fact: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          observations: { type: Type.STRING },
          consensus_level: { type: Type.STRING, enum: ["alto", "médio", "debatido"] }
        },
        required: ["word", "origin", "history", "meaning", "card_summary", "related_words", "fun_fact", "consensus_level"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as EtymologyData;
  } catch (e) {
    console.error("Failed to parse Gemini response for WOTD", e);
    throw new Error("Não foi possível processar a palavra do dia.");
  }
}
