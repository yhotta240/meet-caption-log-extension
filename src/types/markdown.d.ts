declare module "*CHANGELOG.md" {
  import type { VersionItem } from "../popup/types";
  const changelog: VersionItem[];
  export default changelog;
}

declare module "*.md" {
  import type { DocItem } from "../popup/types";
  const doc: DocItem;
  export default doc;
}
