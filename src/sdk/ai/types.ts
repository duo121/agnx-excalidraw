export type ModelProvider = {
  id: string;
  name: string;
  type?: string;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  enabled?: boolean;
};

export type ActiveModelSelection = {
  providerId: string;
  model: string;
};

export interface AppConfig {
  models?: ModelProvider[];
  activeModel?: ActiveModelSelection | null;
  [key: string]: any;
}

export type LocalToolServerConfig = any;
