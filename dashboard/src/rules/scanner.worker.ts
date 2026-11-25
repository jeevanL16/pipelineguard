import { analyzeWorkflowText } from "./analyzer";

self.onmessage = (event: MessageEvent<{ id: number; yaml: string; file?: string }>) => {
  const { id, yaml, file } = event.data;
  const result = analyzeWorkflowText(yaml, file || "playground.yml");
  self.postMessage({ id, result });
};
