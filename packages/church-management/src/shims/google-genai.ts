/* eslint-disable @typescript-eslint/no-explicit-any */
export class GoogleGenAI {
  constructor(_options: { apiKey?: string }) {}
  models = {
    generateContent: async (_options: { model?: string; contents?: string; config?: any }) => {
      return {
        text: "Blessings! Heavenly God Kingdom Churches welcomes you into God's presence.",
      };
    },
  };
}

export default GoogleGenAI;

