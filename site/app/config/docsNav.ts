export type DocsNavItem = {
  key: string;
  path: string;
  /** When set, item is a child of this nav key (shown indented in sidebar). */
  parent?: string;
};

/**
 * Accordion behaviour for nested sidebar groups.
 * - expandable: false → children always visible (legacy indent only)
 * - defaultOpen: initial open state when expandable
 * - persist: remember open/closed per parent key in localStorage
 */
export const docsNavAccordion = {
  expandable: true,
  defaultOpen: false,
  persist: true,
} as const;

/**
 * Edit this list to shape the docs sidebar / pager.
 * Labels come from `i18n/locales/{ja,en}.json` → `nav.<key>`.
 */
export const docsNavItems: DocsNavItem[] = [
  { key: "home", path: "/" },
  { key: "gettingStarted", path: "/getting-started" },
  { key: "installation", path: "/installation" },
  { key: "usage", path: "/usage" },
  { key: "api", path: "/api" },
  { key: "examples", path: "/examples" },
  {
    key: "examplesAddressInput",
    path: "/examples/address-input",
    parent: "examples",
  },
  {
    key: "examplesMunicipalityValidation",
    path: "/examples/municipality-validation",
    parent: "examples",
  },
  {
    key: "examplesNationwideMunicipalities",
    path: "/examples/nationwide-municipalities",
    parent: "examples",
  },
  { key: "playground", path: "/playground" },
  { key: "contribute", path: "/contribute" },
];
