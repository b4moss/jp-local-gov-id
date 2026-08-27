export type DocsNavItem = {
  key: string;
  path: string;
  /** When set, item is a child of this nav key (shown indented in sidebar). */
  parent?: string;
};

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

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

export function useDocsNav() {
  const { t } = useI18n();
  const localePath = useLocalePath();

  const items = computed(() =>
    docsNavItems.map((item) => ({
      ...item,
      label: t(`nav.${item.key}`),
      to: localePath(item.path),
    })),
  );

  return { items };
}

export function useDocsPager() {
  const route = useRoute();
  const { items } = useDocsNav();

  const index = computed(() => {
    const current = normalizePath(route.path);
    return items.value.findIndex(
      (item) => normalizePath(String(item.to)) === current,
    );
  });

  const prev = computed(() => {
    const i = index.value;
    return i > 0 ? items.value[i - 1] : null;
  });

  const next = computed(() => {
    const i = index.value;
    return i >= 0 && i < items.value.length - 1 ? items.value[i + 1] : null;
  });

  return { prev, next };
}
