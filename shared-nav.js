/* =========================================
   CAMPUSORA — SHARED TOP NAVIGATION
   Official Campusora Navigation
========================================= */

(() => {
  "use strict";

  if (window.CampusoraNavigationLoaded) return;
  window.CampusoraNavigationLoaded = true;

  const HOME = "home-feed.html";

  const currentFile =
    location.pathname.split("/").pop() || HOME;

  const icons = {

    home: `<svg viewBox="0 0 24 24">
      <path d="m3 10 9-7 9 7"/>
      <path d="M5 9v11h14V9"/>
      <path d="M9 20v-7h6v7"/>
    </svg>`,

    suggestions: `<svg viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3"/>
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      <path d="M17 8h5M19.5 5.5v5"/>
    </svg>`,

    messages: `<svg viewBox="0 0 24 24">
      <path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-4.3A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/>
    </svg>`,

    spotlight: `<svg viewBox="0 0 24 24">
      <path d="m9 6 10 6-10 6V6Z"/>
      <path d="M4 4v16"/>
    </svg>`,

    notifications: `<svg viewBox="0 0 24 24">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
      <path d="M10 21h4"/>
    </svg>`,

    marketplace: `<svg viewBox="0 0 24 24">
      <path d="M3 9h18l-2-6H5L3 9Z"/>
      <path d="M5 9v12h14V9"/>
      <path d="M9 21v-7h6v7"/>
    </svg>`,

    menu: `<svg viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>`,

    close: `<svg viewBox="0 0 24 24">
      <path d="m18 6-12 12M6 6l12 12"/>
    </svg>`,

    profile: `<svg viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>
    </svg>`,

    community: `<svg viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3"/>
      <circle cx="17" cy="9" r="2.5"/>
      <path d="M2.5 20c0-3.5 2.5-6 6.5-6s6.5 2.5 6.5 6"/>
      <path d="M16 14c3.2 0 5.5 2 5.5 5"/>
    </svg>`,

    events: `<svg viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M7 3v4M17 3v4M3 10h18"/>
    </svg>`,

    rewards: `<svg viewBox="0 0 24 24">
      <path d="M12 3v18M5 8h14M7 8l-4 7h8L7 8ZM17 8l-4 7h8l-4-7Z"/>
    </svg>`,

    settings: `<svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"/>
      <path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.7a8 8 0 0 1-2 .8l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-2-.8l-1.7.7-1.5-2.6 1.4-1.1a8 8 0 0 1 0-2.1l-1.4-1.1 1.5-2.6 1.7.7a8 8 0 0 1 2-.8l.3-1.8h3l.3 1.8a8 8 0 0 1 2 .8l1.7-.7 1.5 2.6-1.4 1.1a8 8 0 0 1 0 2.1Z"/>
    </svg>`,

    safety: `<svg viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>`,

    help: `<svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/>
      <path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-1.2 1-2 1.4-2 3"/>
      <path d="M12 17h.01"/>
    </svg>`
  };

  /* =========================================
     CREATE TOP HEADER
  ========================================= */

  const topbar = document.createElement("header");

  topbar.className = "campusora-topnav";

  /* BRANDING ROW */

  const brandRow = document.createElement("div");

  brandRow.className =
    "campusora-topnav-brandrow";

  const brand = document.createElement("a");

  brand.className = "campusora-brand";
  brand.href = HOME;

  brand.setAttribute(
    "aria-label",
    "Campusora Home"
  );

  const logo = document.createElement("img");

  logo.src = "campusora-logo.png";
  logo.alt = "Campusora logo";

  const brandName = document.createElement("span");

  brandName.className = "campusora-brand-name";
  brandName.textContent = "Campusora";

  brand.append(logo, brandName);

  const tagline = document.createElement("div");

  tagline.className = "campusora-tagline";

  tagline.textContent =
    "Connect with students across campuses";

  brandRow.append(brand, tagline);

  /* =========================================
     MAIN NAVIGATION
  ========================================= */

  const mainNav = document.createElement("nav");

  mainNav.className = "campusora-mainnav";

  mainNav.setAttribute(
    "aria-label",
    "Main navigation"
  );

  const navItems = [

    ["Home", HOME, "home"],

    ["Suggestions", "suggestions.html", "suggestions"],

    ["Messages", "messages.html", "messages"],

    ["Spotlight", "spotlight.html", "spotlight"],

    ["Notifications", "notifications.html", "notifications"],

    ["Marketplace", "marketplace.html", "marketplace"]

  ];

  navItems.forEach(([label, file, icon]) => {

    const link = document.createElement("a");

    link.className = "campusora-nav-item";

    link.href = file;

    link.title = label;

    link.setAttribute("aria-label", label);

    link.innerHTML =
      `${icons[icon]}<span>${label}</span>`;

    if (currentFile === file) {

      link.classList.add("active");

      link.setAttribute(
        "aria-current",
        "page"
      );
    }

    mainNav.appendChild(link);

  });

  /* MENU BUTTON */

  const menuButton = document.createElement("button");

  menuButton.className =
    "campusora-nav-item campusora-menu-button";

  menuButton.type = "button";

  menuButton.title = "Menu";

  menuButton.setAttribute(
    "aria-label",
    "Open menu"
  );

  menuButton.innerHTML =
    `${icons.menu}<span>Menu</span>`;

  mainNav.appendChild(menuButton);

  topbar.append(brandRow, mainNav);

  /* =========================================
     MENU DRAWER
  ========================================= */

  const overlay = document.createElement("div");

  overlay.className = "campusora-menu-overlay";

  const drawer = document.createElement("aside");

  drawer.className = "campusora-menu-drawer";

  drawer.setAttribute(
    "aria-label",
    "Campusora menu"
  );

  const menuHeader = document.createElement("div");

  menuHeader.className = "campusora-menu-header";

  const menuTitle = document.createElement("h3");

  menuTitle.textContent = "Campusora Menu";

  const closeButton = document.createElement("button");

  closeButton.className = "campusora-menu-close";

  closeButton.type = "button";

  closeButton.setAttribute(
    "aria-label",
    "Close menu"
  );

  closeButton.innerHTML = icons.close;

  menuHeader.append(menuTitle, closeButton);

  const menuLinks = document.createElement("div");

  menuLinks.className = "campusora-menu-links";

  const menuItems = [

    ["My Profile", "profile.html", "profile"],

    ["Communities", "communities.html", "community"],

    ["Events", "events.html", "events"],

    ["Creator Rewards", "creator-rewards.html", "rewards"],

    ["Settings", "settings.html", "settings"],

    ["Account Management", "account-management.html", "settings"],

    ["Safety Centre", "safety-centre.html", "safety"],

    ["Help & Support", "help-support.html", "help"]

  ];

  menuItems.forEach(([label, file, icon]) => {

    const link = document.createElement("a");

    link.className = "campusora-menu-link";

    link.href = file;

    link.innerHTML =
      `${icons[icon]}<span>${label}</span>`;

    menuLinks.appendChild(link);

  });

  drawer.append(menuHeader, menuLinks);

  overlay.appendChild(drawer);

  /* =========================================
     MENU ACTIONS
  ========================================= */

  function openMenu() {

    overlay.classList.add("open");

    document.body.style.overflow = "hidden";

    closeButton.focus();

  }

  function closeMenu() {

    overlay.classList.remove("open");

    document.body.style.overflow = "";

    menuButton.focus();

  }

  menuButton.addEventListener(
    "click",
    openMenu
  );

  closeButton.addEventListener(
    "click",
    closeMenu
  );

  overlay.addEventListener("click", event => {

    if (event.target === overlay) {

      closeMenu();

    }

  });

  document.addEventListener("keydown", event => {

    if (
      event.key === "Escape" &&
      overlay.classList.contains("open")
    ) {

      closeMenu();

    }

  });

  /* =========================================
     INSTALL NAVIGATION
  ========================================= */

  function installNavigation() {

    if (
      document.querySelector(".campusora-topnav")
    ) return;

    document.body.classList.add(
      "has-shared-nav"
    );

    document.body.prepend(topbar);

    document.body.appendChild(overlay);

  }

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      installNavigation
    );

  } else {

    installNavigation();

  }

})();
