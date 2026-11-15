export * from "@bazion/education-contracts";
export * from "./ui/index.js";

export { default as BmiNavbar } from "./website/components/Navbar.js";
export { default as BmiFooter } from "./website/components/Footer.js";
export { default as BmiCookieBanner } from "./website/components/CookieBanner.js";
export { default as BmiHeroSlider } from "./website/components/HeroSlider.js";
export { default as BmiPageHero } from "./website/components/PageHero.js";

export { default as BmiHomePage } from "./website/pages/HomePage.js";
export { default as BmiAboutPage } from "./website/pages/AboutPage.js";
export { default as BmiAcademicsPage } from "./website/pages/AcademicsPage.js";
export { default as BmiAccreditationPage } from "./website/pages/AccreditationPage.js";
export { default as BmiAdmissionsPage } from "./website/pages/AdmissionsPage.js";
export { default as BmiApplyPage } from "./website/pages/ApplyPage.js";
export { default as BemiInstitutePage } from "./website/pages/BemiInstitutePage.js";
export { default as BemiRedirectPage } from "./website/pages/BemiRedirectPage.js";
export { default as BmiContactPage } from "./website/pages/ContactPage.js";
export { default as BmiInstitutesPage } from "./website/pages/InstitutesPage.js";
export { default as BmiPrivacyPage } from "./website/pages/PrivacyPage.js";
export { default as BmiTermsPage } from "./website/pages/TermsPage.js";
export { default as BmiVerifyPage } from "./website/pages/VerifyPage.js";

export {
  getPortalPrograms,
  getPortalStats,
  getPortalPosts,
  getPortalPost,
  getPortalPage,
} from "./website/lib/portalApi.js";
export { PROGRAMS as BMI_PROGRAMS } from "./website/lib/programs.js";

