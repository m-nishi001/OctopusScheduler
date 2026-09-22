/// <reference types="vite/client" />

// Basic Vue shims so TypeScript can import .vue single-file components
declare module "*.vue" {
  import { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
