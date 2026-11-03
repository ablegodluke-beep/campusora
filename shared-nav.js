(() => {
"use strict";

if (window.CampusoraNavigationLoaded) return;
window.CampusoraNavigationLoaded = true;

const HOME = "home-feed.html";
const MENU = "menu.html";
const currentFile = location.pathname.split("/").pop() || HOME;

const icons = {
home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 10.2 12 2.5l9.5 7.7v9.5a1.8 1.8 0 0 1-1.8 1.8h-4.9v-7h-5.6v7H4.3a1.8 1.8 0 0 1-1.8-1.8z"/></svg>`,

suggestions: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><circle cx="18" cy="9" r="3"/><path d="M1.5 20.5c0-4.1 3.1-7 7.5-7s7.5 2.9 7.5 7v1h-15z"/><path d="M16 14.1c3.8-.1 6.5 2.2 6.5 5.8v1h-4v-1c0-2.1-.8-4.1-2.5-5.8z"/></svg>`,

messages: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2C6.1 2.2 1.8 6 1.8 11.2c0 2.4 1 4.5 2.8 6.1l-.8 4.5 5-2.4c1 .3 2.1.5 3.2.5 5.9 0 10.2-3.8 10.2-8.7S17.9 2.2 12 2.2Z"/><circle cx="7.5" cy="11.5" r="1.25"/><circle cx="12" cy="11.5" r="1.25"/><circle cx="16.5" cy="11.5" r="1.25"/></svg>`,

spotlight: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="6"/><path d="M9 6.8v10.4a.8.8 0 0 0 1.2.7l8-5.2a.8.8 0 0 0 0-1.4l-8-5.2a.8.8 0 0 0-1.2.7Z"/></svg>`,

notifications: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 9.5a6.5 6.5 0 0 0-13 0c0 7-3 7.2-3 9.2h19c0-2-3-2.2-3-9.2Z"/><path d="M9 21h6a3 3 0 0 1-6 0Z"/></svg>`,

marketplace: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5 5 3h14l2 5.5v2a3.2 3.2 0 0 1-5.8 1.9A3.2 3.2 0 0 1 9.4 12a3.2 3.2 0 0 1-5.9-1.5v-2Z"/><path d="M5 13v8h14v-8a4.1 4.1 0 0 1-3.8-1.7A4.1 4.1 0 0 1 12 13a4.1 4.1 0 0 1-3.2-1.7A4.1 4.1 0 0 1 5 13Z"/><path d="M9 21v-5h6v5"/></svg>`,

menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="9" height="9" rx="2.5"/><rect x="13" y="2" width="9" height="9" rx="2.5"/><rect x="2" y="13" width="9" height="9" rx="2.5"/><rect x="13" y="13" width="9" height="9" rx="2.5"/></svg>`,

search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>`
};

/* =====================================
CREATE SHARED HEADER
===================================== */

const topbar = document.createElement("header");
topbar.className = "campusora-topnav";

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

/* SEARCH */

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
searchInput.placeholder = "Search Campusora...";
searchInput.autocomplete = "off";
searchInput.setAttribute("aria-label", "Search Campusora");
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

/* =====================================
MAIN NAVIGATION
===================================== */

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

const navLinks = {};

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

if (icon === "messages" || icon === "notifications") {
const badge = document.createElement("span");

badge.className = "campusora-nav-badge";
badge.hidden = true;
badge.setAttribute("aria-label", "Unread count");

link.appendChild(badge);
navLinks[icon] = badge;
}

mainNav.appendChild(link);
});

topbar.append(brandRow, mainNav);

/* =====================================
NAVIGATION SCROLL BEHAVIOUR
===================================== */

function setupNavigationScroll() {
let lastScrollPosition = Math.max(0, window.scrollY);
let ticking = false;

function handleScroll() {
const currentPosition = Math.max(0, window.scrollY);
const difference = currentPosition - lastScrollPosition;

if (currentPosition <= 0) {
topbar.classList.remove("nav-hidden");
lastScrollPosition = currentPosition;
ticking = false;
return;
}

const originalNavHeight = topbar.offsetHeight;

if (currentPosition <= originalNavHeight) {
topbar.classList.remove("nav-hidden");
lastScrollPosition = currentPosition;
ticking = false;
return;
}

if (difference > 0) {
topbar.classList.add("nav-hidden");
} else if (difference < 0) {
topbar.classList.remove("nav-hidden");
}

lastScrollPosition = currentPosition;
ticking = false;
}

window.addEventListener("scroll", () => {
if (!ticking) {
window.requestAnimationFrame(handleScroll);
ticking = true;
}
}, { passive: true });

if (window.scrollY > topbar.offsetHeight) {
topbar.classList.add("nav-hidden");
} else {
topbar.classList.remove("nav-hidden");
}
}

/* =====================================
INSTALL NAVIGATION
===================================== */

function installNavigation() {
if (document.querySelector(".campusora-topnav")) return;

document.body.classList.add("has-shared-nav");
document.body.prepend(topbar);

setupNavigationScroll();
}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", installNavigation);
} else {
installNavigation();
}

/* =====================================
NOTIFICATION BADGES
===================================== */

function updateBadge(type, count) {
const badge = navLinks[type];
if (!badge) return;

const number = Number(count) || 0;

badge.hidden = number <= 0;
badge.textContent = number > 99 ? "99+" : String(number);
badge.setAttribute("aria-label", number + " unread " + type);
}

let supabaseClient = null;
let messageChannel = null;
let notificationChannel = null;
let badgeTimer = null;
let refreshInProgress = false;
let realtimeSetupPromise = null;

async function getSupabase() {
if (supabaseClient) return supabaseClient;

const module = await import("./supabase.js");
supabaseClient = module.supabase;

return supabaseClient;
}

async function loadMessageBadge(supabase, user) {
const { data: memberships, error } = await supabase
.from("conversation_members")
.select("conversation_id,last_read_at,joined_at")
.eq("user_id", user.id);

if (error) throw error;

if (!memberships || !memberships.length) {
updateBadge("messages", 0);
return;
}

let unreadCount = 0;
const batchSize = 10;

for (let i = 0; i < memberships.length; i += batchSize) {
const batch = memberships.slice(i, i + batchSize);

const counts = await Promise.all(batch.map(async member => {
let query = supabase
.from("messages")
.select("id", { count: "exact", head: true })
.eq("conversation_id", member.conversation_id)
.neq("sender_id", user.id)
.is("deleted_at", null);

const lastRead = member.last_read_at || member.joined_at;

if (lastRead) {
query = query.gt("created_at", lastRead);
}

const { count, error } = await query;

if (error) throw error;

return count || 0;
}));

unreadCount += counts.reduce((sum, count) => sum + count, 0);
}

updateBadge("messages", unreadCount);
}

async function loadNotificationBadge(supabase, user) {
const { count, error } = await supabase
.from("notifications")
.select("id", { count: "exact", head: true })
.eq("recipient_id", user.id)
.eq("is_read", false);

if (error) throw error;

updateBadge("notifications", count || 0);
}

async function refreshBadges() {
if (refreshInProgress) return;

refreshInProgress = true;

try {
const supabase = await getSupabase();

const {
data: { user },
error
} = await supabase.auth.getUser();

if (error || !user) {
updateBadge("messages", 0);
updateBadge("notifications", 0);
return;
}

await Promise.all([
loadMessageBadge(supabase, user),
loadNotificationBadge(supabase, user)
]);

} catch (error) {
console.error("Campusora badge error:", error);
} finally {
refreshInProgress = false;
}
}

async function setupBadgeRealtime() {
if (realtimeSetupPromise) return realtimeSetupPromise;

realtimeSetupPromise = (async () => {
try {
const supabase = await getSupabase();

const {
data: { user },
error
} = await supabase.auth.getUser();

if (error || !user) {
updateBadge("messages", 0);
updateBadge("notifications", 0);
return;
}

if (messageChannel) {
await supabase.removeChannel(messageChannel);
messageChannel = null;
}

if (notificationChannel) {
await supabase.removeChannel(notificationChannel);
notificationChannel = null;
}

messageChannel = supabase
.channel("campusora-nav-messages-" + user.id)
.on("postgres_changes", {
event: "*",
schema: "public",
table: "messages"
}, () => refreshBadges())
.on("postgres_changes", {
event: "UPDATE",
schema: "public",
table: "conversation_members",
filter: "user_id=eq." + user.id
}, () => refreshBadges())
.subscribe();

notificationChannel = supabase
.channel("campusora-nav-notifications-" + user.id)
.on("postgres_changes", {
event: "*",
schema: "public",
table: "notifications",
filter: "recipient_id=eq." + user.id
}, () => refreshBadges())
.subscribe();

await refreshBadges();

} catch (error) {
console.error("Campusora live badges error:", error);
}
})();

try {
await realtimeSetupPromise;
} finally {
realtimeSetupPromise = null;
}
}

async function handleAuthChange(event) {
if (event === "SIGNED_IN") {
await setupBadgeRealtime();
}

if (event === "TOKEN_REFRESHED") {
await refreshBadges();
}

if (event === "SIGNED_OUT") {
updateBadge("messages", 0);
updateBadge("notifications", 0);

const supabase = supabaseClient;

if (supabase && messageChannel) {
await supabase.removeChannel(messageChannel);
messageChannel = null;
}

if (supabase && notificationChannel) {
await supabase.removeChannel(notificationChannel);
notificationChannel = null;
}
}
}

async function startBadges() {
try {
const supabase = await getSupabase();

supabase.auth.onAuthStateChange((event) => {
setTimeout(() => handleAuthChange(event), 0);
});

await setupBadgeRealtime();

if (badgeTimer) clearInterval(badgeTimer);

badgeTimer = setInterval(() => {
refreshBadges();
}, 60000);

document.addEventListener("visibilitychange", () => {
if (!document.hidden) refreshBadges();
});

} catch (error) {
console.error("Campusora badge startup error:", error);
}
}

startBadges();

/* =====================================
GLOBAL SEARCH
===================================== */

let searchTimer = null;
let searchRequest = 0;

const categoryNames = {
people: "People",
posts: "Posts",
videos: "Spotlight videos",
communities: "Communities"
};

function closeSearchResults() {
searchResults.hidden = true;
searchResults.classList.remove("show");
searchInput.setAttribute("aria-expanded", "false");
}

function openSearchResults() {
searchResults.hidden = false;
searchResults.classList.add("show");
searchInput.setAttribute("aria-expanded", "true");
}

function showMessage(message) {
searchResults.replaceChildren();

const box = document.createElement("div");
box.className = "campusora-search-message";
box.textContent = message;

searchResults.appendChild(box);
openSearchResults();
}

function createTextElement(tag, className, text) {
const element = document.createElement(tag);

element.className = className;
element.textContent = text || "";

return element;
}

function createAvatar(url) {
const avatar = document.createElement("img");

avatar.className = "campusora-search-avatar";
avatar.alt = "";
avatar.loading = "lazy";

avatar.src = url || (
"data:image/svg+xml;charset=UTF-8," +
encodeURIComponent(
"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#202943'/><circle cx='50' cy='37' r='19' fill='#7785a8'/><path d='M15 100c2-24 16-36 35-36s33 12 35 36' fill='#7785a8'/></svg>"
)
);

avatar.onerror = () => {
avatar.onerror = null;

avatar.src = "data:image/svg+xml;charset=UTF-8," +
encodeURIComponent(
"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#202943'/></svg>"
);
};

return avatar;
}

function createResult(title, subtitle, url, avatarURL, type) {
const link = document.createElement("a");

link.className = "campusora-search-result";
link.href = url;

if (avatarURL) {
link.appendChild(createAvatar(avatarURL));
} else {
const symbol = document.createElement("span");

symbol.className = "campusora-search-result-symbol";

symbol.textContent =
type === "video" ? "▶" :
type === "community" ? "◉" : "▤";

link.appendChild(symbol);
}

const info = document.createElement("div");
info.className = "campusora-search-result-info";

info.append(
createTextElement("strong", "", title),
createTextElement("small", "", subtitle)
);

link.appendChild(info);

return link;
}

async function safeSearch(name, callback) {
try {
const data = await callback();

return {
name,
data: data || [],
error: null
};

} catch (error) {
console.error("Campusora " + name + " search error:", error);

return {
name,
data: [],
error
};
}
}

async function searchPeople(supabase, pattern) {
const [names, usernames] = await Promise.all([
supabase.from("profiles")
.select("id,username,full_name,school,avatar_url")
.ilike("full_name", pattern)
.limit(5),

supabase.from("profiles")
.select("id,username,full_name,school,avatar_url")
.ilike("username", pattern)
.limit(5)
]);

if (names.error) throw names.error;
if (usernames.error) throw usernames.error;

const combined = [
...(names.data || []),
...(usernames.data || [])
];

return [
...new Map(
combined.map(item => [item.id, item])
).values()
].slice(0, 5);
}

async function searchPosts(supabase, pattern) {
const { data, error } = await supabase
.from("posts")
.select("id,user_id,content,created_at")
.ilike("content", pattern)
.order("created_at", { ascending: false })
.limit(5);

if (error) throw error;

return data || [];
}

async function searchVideos(supabase, pattern) {
const { data, error } = await supabase
.from("spotlight_videos")
.select("id,user_id,caption,thumbnail_url,created_at")
.ilike("caption", pattern)
.order("created_at", { ascending: false })
.limit(5);

if (error) throw error;

return data || [];
}

async function searchCommunities(supabase, pattern) {
const [names, descriptions] = await Promise.all([
supabase.from("communities")
.select("id,name,school,description")
.ilike("name", pattern)
.limit(5),

supabase.from("communities")
.select("id,name,school,description")
.ilike("description", pattern)
.limit(5)
]);

if (names.error) throw names.error;
if (descriptions.error) throw descriptions.error;

const combined = [
...(names.data || []),
...(descriptions.data || [])
];

return [
...new Map(
combined.map(item => [item.id, item])
).values()
].slice(0, 5);
}

async function getProfiles(supabase, ids) {
const uniqueIds = [...new Set(ids.filter(Boolean))];

if (!uniqueIds.length) return {};

const { data, error } = await supabase
.from("profiles")
.select("id,full_name,username,avatar_url")
.in("id", uniqueIds);

if (error) throw error;

return Object.fromEntries(
(data || []).map(profile => [
profile.id,
profile
])
);
}

function addSection(title, items) {
if (!items.length) return;

const section = document.createElement("section");
section.className = "campusora-search-section";

section.appendChild(
createTextElement(
"div",
"campusora-search-section-title",
title
)
);

items.forEach(item => {
section.appendChild(item);
});

searchResults.appendChild(section);
}

async function renderSearchResults(supabase, results, requestNumber) {
if (requestNumber !== searchRequest) return;

searchResults.replaceChildren();

const people = results.people || [];
const posts = results.posts || [];
const videos = results.videos || [];
const communities = results.communities || [];

let postProfiles = {};
let videoProfiles = {};

try {
[
postProfiles,
videoProfiles
] = await Promise.all([
getProfiles(supabase, posts.map(item => item.user_id)),
getProfiles(supabase, videos.map(item => item.user_id))
]);

} catch (error) {
console.error("Campusora author lookup error:", error);
}

if (requestNumber !== searchRequest) return;

addSection(
categoryNames.people,
people.map(user =>
createResult(
user.full_name || "Campusora Member",
[
user.username ? "@" + user.username : "",
user.school || ""
].filter(Boolean).join(" · ") || "Campusora member",
"profile.html?id=" + encodeURIComponent(user.id),
user.avatar_url,
"person"
))
);

addSection(
categoryNames.posts,
posts.map(post => {
const author = postProfiles[post.user_id] || {};

const preview = (
post.content || "Shared a post"
).trim();

const destination = author.id
? "profile.html?id=" +
encodeURIComponent(author.id) +
"#post-" +
encodeURIComponent(post.id)
: "home-feed.html";

return createResult(
preview.length > 75
? preview.slice(0, 75) + "..."
: preview,
"By " + (
author.full_name ||
author.username ||
"Campusora member"
),
destination,
author.avatar_url,
"post"
);
})
);

addSection(
categoryNames.videos,
videos.map(video => {
const author = videoProfiles[video.user_id] || {};

return createResult(
video.caption || "Spotlight video",
"By " + (
author.full_name ||
author.username ||
"Campusora creator"
),
"spotlight.html",
video.thumbnail_url || author.avatar_url,
"video"
);
})
);

addSection(
categoryNames.communities,
communities.map(community =>
createResult(
community.name || "Campus community",
[
community.school || "",
community.description || ""
].filter(Boolean).join(" · ").slice(0, 100),
"communities.html",
null,
"community"
))
);

if (!searchResults.children.length) {
showMessage("No matching results found.");
return;
}

openSearchResults();
}

async function searchCampusora(term) {
const requestNumber = ++searchRequest;

showMessage("Searching Campusora...");

try {
const supabase = await getSupabase();
const pattern = "%" + term + "%";

const results = await Promise.all([
safeSearch("people", () => searchPeople(supabase, pattern)),
safeSearch("posts", () => searchPosts(supabase, pattern)),
safeSearch("videos", () => searchVideos(supabase, pattern)),
safeSearch("communities", () => searchCommunities(supabase, pattern))
]);

if (requestNumber !== searchRequest) return;

const grouped = {
people: results[0].data,
posts: results[1].data,
videos: results[2].data,
communities: results[3].data
};

const total = Object.values(grouped)
.reduce((sum, items) => sum + items.length, 0);

if (total === 0) {
const failed = results.every(result => result.error);

showMessage(
failed
? "Search is temporarily unavailable. Please try again."
: "No matching results found."
);

return;
}

await renderSearchResults(
supabase,
grouped,
requestNumber
);

} catch (error) {
if (requestNumber !== searchRequest) return;

console.error("Campusora search error:", error);

showMessage(
"Search is temporarily unavailable. Please try again."
);
}
}

/* SEARCH INPUT */

searchInput.addEventListener("input", () => {
clearTimeout(searchTimer);

const term = searchInput.value.trim();

if (term.length < 2) {
searchRequest++;
closeSearchResults();
return;
}

openSearchResults();

searchTimer = setTimeout(() => {
searchCampusora(term);
}, 350);
});

searchForm.addEventListener("submit", event => {
event.preventDefault();

const term = searchInput.value.trim();

if (term.length >= 2) {
searchCampusora(term);
}
});

searchInput.addEventListener("focus", () => {
const term = searchInput.value.trim();

if (term.length >= 2) {
searchCampusora(term);
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
