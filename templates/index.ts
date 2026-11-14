export { globalMissionConfig } from "./global-mission.config.js";
export type { MinistryConfig, ChurchTheme, ChurchDepartment, ChurchSmallGroup, ChurchAsset, ChurchVolunteerTeam, ChurchTestimony } from "./church.types.js";
export {
  churchThemePresets,
  sampleDepartments,
  sampleMinistries,
  sampleSmallGroups,
  sampleAssets,
  sampleVolunteerTeams,
  sampleTestimonies,
  type ThemePresetDefinition,
} from "./church-sample-data.js";
export {
  churchTemplateCatalog,
  ensureAccessibleHexColor,
  getTemplateDescriptor,
  createWhiteLabeledChurchConfig,
  extractWhiteLabelTemplateFromRepoSource,
  generateByowDokployCompose,
  platformWhiteLabelPackageCatalog,
  universalThemePalettes,
  createWhiteLabeledPackageConfig,
  extractWhiteLabelFromRepoSource,
  type WhiteLabelTemplateId,
  type WhiteLabelTemplateDescriptor,
  type WhiteLabelTemplateInput,
  type WhiteLabelGeneratedOutput,
  type ByowFramework,
  type RepoWhiteLabelVariable,
  type RepoWhiteLabelExtractionInput,
  type RepoWhiteLabelExtractionResult,
  type ByowComposeInput,
  type ByowComposeBlueprint,
} from "./whitelabel-template.js";
