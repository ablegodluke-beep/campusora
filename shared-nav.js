(() => {
"use strict";

if (window.CampusoraNavigationLoaded) return;
window.CampusoraNavigationLoaded = true;

const HOME = "home-feed.html";
const MENU = "menu.html";
const currentFile = location.pathname.split("/").pop() || HOME;

const icons = {
home: "<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></svg>",
suggestions: "<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 8h5M19.5 5.5v5"/></svg>",
messages: "<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-4.3A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>",
spotlight: "<svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6V6Z"/><path d="M4 4v16"/></svg>",
notifications: "<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>",
marketplace: "<svg viewBox="0 0 24 24"><path d="M3 9h18l-2-6H5L3 9Z"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/></svg>",
menu: "<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>",
search: "<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>"
};

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

/* SHARED SEARCH */

const searchWrap = document.createElement("div");
searchWrap.className = "campusora-header-search";

const searchForm = document.createElement("form");
searchForm.className = "campusora-header-search-form";
searchForm.setAttribute("role", "search");

const searchIcon = document.createElement("span");
searchIcon.className = "campusora-header-search-icon";
searchIcon.innerHTML = icons.search;

const searchInput = document.createElement("input");
searchInput.type = "search";
searchInput.className = "campusora-header-search-input";
searchInput.placeholder = "Search people...";
searchInput.autocomplete = "off";
searchInput.setAttribute("aria-label", "Search Campusora members");
searchInput.setAttribute("aria-expanded", "false");

const searchResults = document.createElement("div");
searchResults.className = "campusora-header-search-results";
searchResults.hidden = true;

searchForm.append(searchIcon, searchInput);
searchWrap.append(searchForm, searchResults);

/* TAGLINE */

const tagline = document.createElement("div");
tagline.className = "campusora-tagline";
tagline.textContent = "Connect with students across campuses";

brandRow.append(brand, searchWrap, tagline);

/* ICON NAVIGATION */

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

/* SEARCH BEHAVIOUR */

let searchTimer = null;
let searchRequest = 0;
let supabaseClient = null;

function escapeHTML(value = "") {
return String(value).replace(/[&<>"']/g, char => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
})[char]);
}

function closeSearchResults() {
searchResults.hidden = true;
searchInput.setAttribute("aria-expanded", "false");
}

function openSearchResults() {
searchResults.hidden = false;
searchInput.setAttribute("aria-expanded", "true");
}

function showSearchMessage(message) {
searchResults.innerHTML = "<div class="campusora-search-message">${escapeHTML(message)}</div>";
openSearchResults();
}

async function getSupabase() {
if (supabaseClient) return supabaseClient;

const module = await import("./supabase.js");
supabaseClient = module.supabase;

return supabaseClient;
}

function goToFullSearch() {
const term = searchInput.value.trim();

if (term.length < 2) return;

window.location.href =
"search.html?q=" + encodeURIComponent(term);
}

async function searchCampusoraPeople(term) {
const requestNumber = ++searchRequest;

showSearchMessage("Searching Campusora...");

try {
const supabase = await getSupabase();
const pattern = "%${term}%";

const { data, error } = await supabase
  .from("profiles")
  .select("id,username,full_name,school,avatar_url")
  .or(`full_name.ilike.${pattern},username.ilike.${pattern}`)
  .limit(8);

if (requestNumber !== searchRequest) return;

if (error) throw error;

if (!data || !data.length) {
  showSearchMessage("No matching people found.");
  return;
}

searchResults.innerHTML = "";

data.forEach(user => {
  const result = document.createElement("a");

  result.className = "campusora-search-result";
  result.href = "profile.html?id=" + encodeURIComponent(user.id);

  const avatar = document.createElement("img");
  avatar.className = "campusora-search-avatar";
  avatar.alt = "";

  avatar.src = user.avatar_url ||
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#202943"/>
        <circle cx="50" cy="37" r="19" fill="#7785a8"/>
        <path d="M15 100c2-24 16-36 35-36s33 12 35 36" fill="#7785a8"/>
      </svg>
    `);

  const info = document.createElement("div");
  info.className = "campusora-search-result-info";

  const fullName = document.createElement("strong");
  fullName.textContent = user.full_name || "Campusora Member";

  const details = document.createElement("span");
  details.textContent =
    (user.username ? "@" + user.username : "") +
    (user.school ? " · " + user.school : "");

  info.append(fullName, details);
  result.append(avatar, info);

  searchResults.appendChild(result);
});

const more = document.createElement("button");
more.type = "button";
more.className = "campusora-search-see-all";
more.textContent = "See all search results";

more.addEventListener("click", goToFullSearch);

searchResults.appendChild(more);
openSearchResults();

} catch (error) {
if (requestNumber !== searchRequest) return;

console.error("Campusora search error:", error);
showSearchMessage("Search is temporarily unavailable. Try again.");

}
}

searchInput.addEventListener("input", () => {
clearTimeout(searchTimer);

const term = searchInput.value.trim();

if (term.length < 2) {
searchRequest++;
closeSearchResults();
return;
}

searchTimer = setTimeout(() => {
searchCampusoraPeople(term);
}, 300);
});

searchForm.addEventListener("submit", event => {
event.preventDefault();
goToFullSearch();
});

searchInput.addEventListener("focus", () => {
if (searchInput.value.trim().length >= 2) {
searchCampusoraPeople(searchInput.value.trim());
}
});

document.addEventListener("click", event => {
if (!searchWrap.contains(event.target)) {
closeSearchResults();
}
});

searchInput.addEventListener("keydown", event => {
if (event.key === "Escape") {
closeSearchResults();
searchInput.blur();
}
});

})();
