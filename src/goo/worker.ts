import { gooOutline, type OutlineInput } from "./trace";

/** Traces the sharp pass off the main thread, so a still canvas never stalls input. */
self.onmessage = (event: MessageEvent<{ job: number; input: OutlineInput }>) => {
  const { job, input } = event.data;
  self.postMessage({ job, parts: gooOutline(input).parts });
};
