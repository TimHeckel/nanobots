export interface ControlRoomContext {
  evidenceSources: string[];
  controlHealth: string[];
  sprintoStatus: string;
}

export async function getControlRoomContext(): Promise<ControlRoomContext> {
  return {
    evidenceSources: ["GitHub", "Sprinto", "Browser Capture"],
    controlHealth: ["Needs review", "Healthy", "At risk"],
    sprintoStatus: "preview",
  };
}
