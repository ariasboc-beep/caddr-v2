import { GoogleGenAI, Type } from "@google/genai";
import { Block, Task } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getRoutineAdvice = async (blocks: Block[], performance: number) => {
  const routineSummary = blocks.map(b => `${b.title}: ${b.tasks.map(t => t.title).join(', ')}`).join('\n');
  
  const prompt = `
    En tant qu'expert en productivité pour l'application Caddr., analyse cette routine :
    ${routineSummary}
    Performance : ${performance}%
    
    Donne un conseil, une tâche "Power Move" et une citation motivante.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            advice: { type: Type.STRING },
            powerTask: { type: Type.STRING },
            motivation: { type: Type.STRING }
          },
          required: ["advice", "powerTask", "motivation"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return null;
  }
};

export const getDailyReviewFeedback = async (tasks: string[], performance: number, reflection: string) => {
  const prompt = `
    Analyse ma journée sur Caddr. :
    Tâches complétées : ${tasks.join(', ')}
    Score global : ${performance}%
    Ma réflexion : "${reflection}"
    
    Donne un feedback constructif et encourageant (max 150 caractères) et un "Focus" pour demain.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feedback: { type: Type.STRING },
            focusTomorrow: { type: Type.STRING }
          },
          required: ["feedback", "focusTomorrow"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return null;
  }
};

export const generateRoutineFromGoal = async (goal: string) => {
  const prompt = `Crée une routine de performance sur Caddr. pour l'objectif suivant : "${goal}". 
  Structure la réponse en blocs logiques (ex: Matin, Travail, Soir). 
  Chaque bloc doit avoir un titre et une liste de 3 à 5 tâches concrètes.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["title", "tasks"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const extractRoutineFromImage = async (base64Image: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          { text: "Extrais les tâches de cette image pour l'application Caddr. et organise-les en blocs logiques avec des titres. Si c'est une liste simple, crée un bloc 'Import Image'." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["title", "tasks"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return null;
  }
};
