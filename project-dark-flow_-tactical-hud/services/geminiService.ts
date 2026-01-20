
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are the Dark-Flow Tactical AI Assistant. You control a 2D fluid dynamics simulation.
Interpret tactical commands and translate them into simulation actions.
Lattice dimensions: 400x200.

Available actions:
- generate_shape: Create geometry. 
  - shape_type 'ball': for spheres, circles, or generic obstacles.
  - shape_type 'naca': for airfoils, hydrofoils, or wings sections.
  - shape_type 'wing': for swept wings, jets, or delta shapes.
  - shape_type 'teardrop': for streamlined drops or low-drag shapes.
- reset_sim: Clear lattice.
- change_velocity: Adjust flow speed (0.0 to 0.2).
- set_viscosity: Adjust fluid viscosity (0.005 to 0.2).

Always respond with a brief tactical message followed by the action details in JSON.
`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getTacticalChat = () => {
  return ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tactical_message: { type: Type.STRING },
          action: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['generate_shape', 'reset_sim', 'change_velocity', 'set_viscosity'] },
              data: {
                type: Type.OBJECT,
                properties: {
                  shape_type: { type: Type.STRING, enum: ['ball', 'naca', 'wing', 'teardrop'] },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  radius: { type: Type.NUMBER },
                  velocity: { type: Type.NUMBER },
                  viscosity: { type: Type.NUMBER }
                }
              }
            },
            required: ["type", "data"]
          }
        },
        required: ["tactical_message", "action"]
      }
    }
  });
};
