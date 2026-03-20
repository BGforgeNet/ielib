/**
 * VitePress configuration for BGforge IElib documentation site.
 */

import { defineConfig } from "vitepress";

export default defineConfig({
  title: "BGforge IElib",
  description: "IElib documentation",

  head: [
    [
      "link",
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/favicon/apple-touch-icon.png",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon/favicon-32x32.png",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon/favicon-16x16.png",
      },
    ],
    ["link", { rel: "manifest", href: "/favicon/site.webmanifest" }],
    [
      "link",
      {
        rel: "mask-icon",
        href: "/favicon/safari-pinned-tab.svg",
        color: "#5bbad5",
      },
    ],
    ["link", { rel: "shortcut icon", href: "/favicon/favicon.ico" }],
    ["meta", { name: "msapplication-TileColor", content: "#00aba9" }],
    [
      "meta",
      { name: "msapplication-config", content: "/favicon/browserconfig.xml" },
    ],
    ["meta", { name: "theme-color", content: "#ffffff" }],
    [
      "script",
      {},
      `var _paq = window._paq = window._paq || [];
_paq.push(['trackPageView']);
_paq.push(['enableLinkTracking']);
(function() {
  var u="//st.bgforge.net/";
  _paq.push(['setTrackerUrl', u+'matomo.php']);
  _paq.push(['setSiteId', '20']);
  var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
  g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
})();`,
    ],
  ],

  themeConfig: {
    logo: "/favicon/android-chrome-512x512.png",

    nav: [
      {
        text: "Forum",
        link: "https://forums.bgforge.net/viewforum.php?f=35",
      },
      {
        text: "GitHub",
        link: "https://github.com/BGforgeNet/ielib",
      },
      { text: "BGforge", link: "https://bgforge.net" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Home", link: "/" },
          { text: "Types", link: "/types" },
        ],
      },
      {
        text: "Functions",
        items: [
          { text: "2DA", link: "/functions/2da" },
          { text: "Areas", link: "/functions/areas" },
          { text: "Creatures", link: "/functions/creatures" },
          { text: "Dialogs", link: "/functions/dialogs" },
          { text: "Items", link: "/functions/items" },
          { text: "Miscellaneous", link: "/functions/misc" },
          { text: "Scripting", link: "/functions/scripting" },
          { text: "Stores", link: "/functions/stores" },
          { text: "String references", link: "/functions/strref" },
        ],
      },
      {
        text: "Constants",
        items: [
          { text: "IDS", link: "/constants/ids" },
          { text: "Spells", link: "/constants/spells" },
          { text: "Opcodes", link: "/constants/opcodes" },
          { text: "Opcode Parameters", link: "/constants/opcode-params" },
          { text: "Offsets", link: "/constants/structures" },
          { text: "Icons", link: "/constants/icons" },
          { text: "Scrolls", link: "/constants/scrolls" },
          { text: "Miscellaneous", link: "/constants/misc" },
        ],
      },
    ],

    editLink: {
      pattern:
        "https://github.com/BGforgeNet/ielib/edit/master/docs/:path",
    },

    search: {
      provider: "local",
    },
  },
});
