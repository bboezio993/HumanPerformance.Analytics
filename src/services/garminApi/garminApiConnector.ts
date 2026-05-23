export interface GarminApiConnector {
  status: "disabled" | "active";
  sourceType: "garmin_api_future";
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncData: () => Promise<void>;
}

export const MockGarminApiConnector: GarminApiConnector = {
  status: "disabled",
  sourceType: "garmin_api_future",
  connect: async () => {
    throw new Error("API Garmin officielle bientôt disponible.");
  },
  disconnect: async () => {
    return;
  },
  syncData: async () => {
    throw new Error("API Garmin officielle bientôt disponible.");
  }
};
