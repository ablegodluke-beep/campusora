/* =========================================
   CAMPUSORA SHARED NAVIGATION
   Official Campusora Navigation System
========================================= */

(() => {
  "use strict";

  if (window.CampusoraNavigationLoaded) return;
  window.CampusoraNavigationLoaded = true;

  const HOME = "home-feed.html";

  const pageNames = {
    "home-feed.html": "Home Feed",
    "suggestions.html": "Suggestions",
    "messages.html": "Messages",
    "explore.html": "Explore",
    "spotlight.html": "Spotlight",
    "notifications.html": "Notifications",
    "profile.html": "Profile",
    "communities.html": "Communities",
    "events.html": "Events",
    "marketplace.html": "Marketplace",
    "creator-rewards.html": "Creator Rewards",
    "settings.html": "Settings",
    "account-management.html": "Account Management",
    "safety-centre.html": "Safety Centre",
    "help-support.html": "Help & Support",
    "about.html": "About Campusora"
  };

  const currentFile = location.pathname.split("/").pop() || HOME;
  const pageTitle =
    document.body.dataset.pageTitle ||
    pageNames[currentFile] ||
    "Campusora";

  const icons = {
    home: `<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></svg>`,

    suggestions: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 8h5M19.5 5.5v5"/></svg>`,

    messages: `<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-4.3A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>`,

    explore: `<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="7.5"/><path d="m16.5 16.5 4 4"/><path d="m8 13 2-4 4-2-2 4-4 2Z"/></svg>`,

    spotlight: `<svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6V6Z"/><path d="M4 4v16"/></svg>`,

    notifications: `<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>`,

    menu: `<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,

    back: `<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/><path d="M9 12h11"/></svg>`,

    close: `<svg viewBox="0 0 24 24"><path d="m18 6-12 12M6 6l12 12"/></svg>`,

    profile: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`,

    community: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c0-3.5 2.5-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 14c3.2 0 5.5 2 5.5 5"/></svg>`,

    events: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>`,

    market: `<svg viewBox="0 0 24 24"><path d="M3 9h18l-2-6H5L3 9Z"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/></svg>`,

    rewards: `<svg viewBox="0 0 24 24"><path d="M12 3v18M5 8h14M7 8l-4 7h8L7 8ZM17 8l-4 7h8l-4-7Z"/></svg>`,

    settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.7a8 8 0 0 1-2 .8l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-2-.8l-1.7.7-1.5-2.6 1.4-1.1a8 8 0 0 1 0-2.1l-1.4-1.1 1.5-2.6 1.7.7a8 8 0 0 1 2-.8l.3-1.8h3l.3 1.8a8 8 0 0 1 2 .8l1.7-.7 1.5 2.6-1.4 1.1a8 8 0 0 1 0 2.1Z"/></svg>`,

    safety: `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg>`,

    help: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-1.2 1-2 1.4-2 3"/><path d="M12 17h.01"/></svg>`
  };

  function makeLink(label, file, icon, activeKey) {
    const link = document.createElement("a");

    link.className = "campusora-nav-item";
    link.href = file;
    link.setAttribute("aria-label", label);
    link.title = label;
    link.innerHTML = icons[icon];

    if (activeKey === file) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

    return link;
  }

  /* =========================================
     TOP NAVIGATION
  ========================================= */

  const topbar = document.createElement("header");
  topbar.className = "campusora-topnav";

  const brand = document.createElement("a");
  brand.className = "campusora-brand";
  brand.href = HOME;
  brand.setAttribute("aria-label", "Campusora Home");

  const logo = document.createElement("img");
  logo.src = "campusora-logo.png";
  logo.alt = "Campusora";
  logo.style.width = "140px";
  logo.style.height = "46px";
  logo.style.objectFit = "contain";

  brand.appendChild(logo);

  const heading = document.createElement("div");
  heading.className = "campusora-page-heading";

  const backButton = document.createElement("button");
  backButton.className = "campusora-back-btn";
  backButton.type = "button";
  backButton.setAttribute("aria-label", "Go back");
  backButton.innerHTML = icons.back;

  backButton.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.href = HOME;
    }
  });

  const title = document.createElement("span");
  title.className = "campusora-page-title";
  title.textContent = pageTitle;

  heading.append(backButton, title);
  topbar.append(brand, heading);

  /* =========================================
     BOTTOM NAVIGATION
  ========================================= */

  const bottom = document.createElement("nav");
  bottom.className = "campusora-bottomnav";
  bottom.setAttribute("aria-label", "Main navigation");

  const navItems = [
    ["Home", HOME, "home"],
    ["Suggestions", "suggestions.html", "suggestions"],
    ["Messages", "messages.html", "messages"],
    ["Explore", "explore.html", "explore"],
    ["Spotlight", "spotlight.html", "spotlight"],
    ["Notifications", "notifications.html", "notifications"]
  ];

  navItems.forEach(([label, file, icon]) => {
    bottom.appendChild(makeLink(label, file, icon, currentFile));
  });

  const menuButton = document.createElement("button");
  menuButton.className = "campusora-nav-item";
  menuButton.type = "button";
  menuButton.setAttribute("aria-label", "Open menu");
  menuButton.title = "Menu";
  menuButton.innerHTML = icons.menu;
  bottom.appendChild(menuButton);

  /* =========================================
     MENU DRAWER
  ========================================= */

  const overlay = document.createElement("div");
  overlay.className = "campusora-menu-overlay";

  const drawer = document.createElement("aside");
  drawer.className = "campusora-menu-drawer";
  drawer.setAttribute("aria-label", "Campusora menu");

  const menuHeader = document.createElement("div");
  menuHeader.className = "campusora-menu-header";

  const menuTitle = document.createElement("h3");
  menuTitle.textContent = "Campusora Menu";

  const closeButton = document.createElement("button");
  closeButton.className = "campusora-menu-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close menu");
  closeButton.innerHTML = icons.close;

  menuHeader.append(menuTitle, closeButton);

  const menuLinks = document.createElement("div");
  menuLinks.className = "campusora-menu-links";

  const menuItems = [
    ["My Profile", "profile.html", "profile"],
    ["Communities", "communities.html", "community"],
    ["Events", "events.html", "events"],
    ["Marketplace", "marketplace.html", "market"],
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
    link.innerHTML = icons[icon] + `<span>${label}</span>`;
    menuLinks.appendChild(link);
  });

  drawer.append(menuHeader, menuLinks);
  overlay.appendChild(drawer);

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

  menuButton.addEventListener("click", openMenu);
  closeButton.addEventListener("click", closeMenu);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay.classList.contains("open")) {
      closeMenu();
    }
  });

  /* =========================================
     ADD NAVIGATION TO PAGE
  ========================================= */

  function installNavigation() {
    if (document.querySelector(".campusora-topnav")) return;

    document.body.classList.add("has-shared-nav");

    document.body.prepend(bottom);
    document.body.prepend(topbar);
    document.body.appendChild(overlay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installNavigation);
  } else {
    installNavigation();
  }

})();
