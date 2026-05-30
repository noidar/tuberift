import type { ElectronAPI } from "../electron/preload/preload";

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

declare module "*.svg" {
  const url: string;
  export default url;
}
