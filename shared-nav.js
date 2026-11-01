(() => {
"use strict";

if (window.CampusoraNavigationLoaded) return;
window.CampusoraNavigationLoaded = true;

const HOME = "home-feed.html";
const MENU = "menu.html";
const currentFile = location.pathname.split("/").pop() || HOME;

/* NAVIGATION ICONS */

const icons = {
home: `<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></svg>`,

suggestions: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 8h5M19.5 5.5v5"/></svg>`,

messages: `<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-4.3A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>`,

spotlight: `<svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6V6Z"/><path d="M4 4v16"/></svg>`,

notifications: `<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>`,

marketplace: `<svg viewBox="0 0 24 24"><path d="M3 9h18l-2-6H5L3 9Z"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/></svg>`,

menu: `<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`
};

/* CREATE HEADER */

const topbar = document.createElement("header");
topbar.className = "campusora-topnav";

/* BRANDING ROW */

const brandRow = document.createElement("div");
brandRow.className = "campusora-topnav-brandrow";

const brand = document.createElement("a");
brand.className = "campusora-brand";
brand.href = HOME;
brand.setAttribute("aria-label", "Campusora Home");

const logo = document.createElement("img");
logo.src = "campusora-logo.png";
logo.alt = "Campusora logo";

const brandName = document.createElement("span");
brandName.className = "campusora-brand-name";
brandName.textContent = "Campusora";

brand.append(logo, brandName);

const tagline = document.createElement("div");
tagline.className = "campusora-tagline";
tagline.textContent = "Connect with students across campuses";

brandRow.append(brand, tagline);

/* MAIN ICON NAVIGATION */

const mainNav = document.createElement("nav");
mainNav.className = "campusora-mainnav";
mainNav.setAttribute("aria-label", "Main navigation");

const navItems = [
["Home", HOME, "home"],
["Suggestions", "suggestions.html", "suggestions"],
["Messages", "messages.html", "messages"],
["Spotlight", "spotlight.html", "spotlight"],
["Notifications", "notifications.html", "notifications"],
["Marketplace", "marketplace.html", "marketplace"],
["Menu", MENU, "menu"]
];

navItems.forEach(([label, file, icon]) => {
const link = document.createElement("a");

link.className = "campusora-nav-item";
link.href = file;
link.title = label;
link.setAttribute("aria-label", label);
link.innerHTML = icons[icon];

if (currentFile === file) {
link.classList.add("active");
link.setAttribute("aria-current", "page");
}

mainNav.appendChild(link);
});

/* INSTALL HEADER */

topbar.append(brandRow, mainNav);

function installNavigation() {
if (document.querySelector(".campusora-topnav")) return;

document.body.classList.add("has-shared-nav");
document.body.prepend(topbar);
}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", installNavigation);
} else {
installNavigation();
}

})();
