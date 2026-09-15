/// <reference types="vite/client" />

// Basic Vue shims so TypeScript can import .vue single-file components
declare module "*.vue" {
  import { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Allow path-alias imports like `components/xxx.vue` used in this package
declare module "components/*" {
  import { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
