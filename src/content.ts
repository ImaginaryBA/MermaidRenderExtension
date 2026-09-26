import { mermaidRenderer } from "./adapters/mermaid-renderer";
import { storageSettings } from "./adapters/storage-settings";
import { mount } from "./controller";

void mount(document, { renderer: mermaidRenderer(), settings: storageSettings() });
