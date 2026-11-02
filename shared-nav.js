(() => {
"use strict";

if (window.CampusoraNavigationLoaded) return;
window.CampusoraNavigationLoaded = true;

const HOME = "home-feed.html";
const MENU = "menu.html";
const currentFile = location.pathname.split("/").pop() || HOME;

const icons = {
home: `<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7"/></svg>`,
suggestions: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 8h5M19.5 5.5v5"/></svg>`,
messages: `<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-4.3A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>`,
spotlight: `<svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6V6ZM4 4v16"/></svg>`,
notifications: `<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>`,
marketplace: `<svg viewBox="0 0 24 24"><path d="M3 9h18l-2-6H5L3 9ZM5 9v12h14V9M9 21v-7h6v7"/></svg>`,
menu: `<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
search: `<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 4.3 4.3"/></svg>`
};

/* HEADER */

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

/* GLOBAL SEARCH */

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

const tagline = document.createElement("div");
tagline.className = "campusora-tagline";
tagline.textContent = "Connect with students across campuses";

brandRow.append(brand, searchWrap, tagline);

/* NAVIGATION */

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
link.style.position = "relative";

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

/* BADGE DISPLAY */

function updateBadge(type, count) {
const badge = navLinks[type];
if (!badge) return;

const number = Number(count) || 0;

badge.hidden = number <= 0;
badge.textContent = number > 99 ? "99+" : String(number);
badge.setAttribute(
"aria-label",
number + " unread " + type
);
}

/* SUPABASE */

let supabaseClient = null;
let currentUser = null;
let messageChannel = null;
let notificationChannel = null;
let badgeTimer = null;

async function getSupabase() {
if (supabaseClient) return supabaseClient;

const module = await import("./supabase.js");
supabaseClient = module.supabase;

return supabaseClient;
}

/* LOAD UNREAD MESSAGE COUNT */

async function loadMessageBadge(supabase, user) {
const { data: memberships, error } = await supabase
.from("conversation_members")
.select("conversation_id,last_read_at,joined_at")
.eq("user_id", user.id);

if (error) throw error;

if (!memberships?.length) {
updateBadge("messages", 0);
return;
}

const ids = memberships.map(item => item.conversation_id);

const { data: messages, error: messageError } = await supabase
.from("messages")
.select("conversation_id,sender_id,created_at,deleted_at")
.in("conversation_id", ids)
.is("deleted_at", null)
.order("created_at", { ascending: false })
.limit(Math.min(1000, ids.length * 50));

if (messageError) throw messageError;

const latestMessages = new Map();

(messages || []).forEach(message => {
if (!latestMessages.has(message.conversation_id)) {
latestMessages.set(message.conversation_id, message);
}
});

let unread = 0;

memberships.forEach(member => {
const last = latestMessages.get(member.conversation_id);

if (!last || last.sender_id === user.id) return;

if (!member.last_read_at) {
unread++;
return;
}

if (
new Date(last.created_at) >
new Date(member.last_read_at)
) {
unread++;
}
});

updateBadge("messages", unread);
}

/* LOAD UNREAD NOTIFICATIONS */

async function loadNotificationBadge(supabase, user) {
const { count, error } = await supabase
.from("notifications")
.select("id", { count: "exact", head: true })
.eq("recipient_id", user.id)
.eq("is_read", false);

if (error) throw error;

updateBadge("notifications", count || 0);
}

/* REFRESH BOTH BADGES */

async function refreshBadges() {
try {
const supabase = await getSupabase();

const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
currentUser = null;
updateBadge("messages", 0);
updateBadge("notifications", 0);
return;
}

currentUser = user;

await Promise.all([
loadMessageBadge(supabase, user),
loadNotificationBadge(supabase, user)
]);

} catch (error) {
console.error("Campusora badge error:", error);
}
}

/* LIVE UPDATES */

async function setupBadgeRealtime() {
try {
const supabase = await getSupabase();

const { data: { user } } = await supabase.auth.getUser();

if (!user) return;

currentUser = user;

if (messageChannel) {
supabase.removeChannel(messageChannel);
}

if (notificationChannel) {
supabase.removeChannel(notificationChannel);
}

messageChannel = supabase
.channel("campusora-nav-messages-" + user.id)
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "messages"
},
() => {
refreshBadges();
}
)
.on(
"postgres_changes",
{
event: "UPDATE",
schema: "public",
table: "conversation_members",
filter: "user_id=eq." + user.id
},
() => {
refreshBadges();
}
)
.subscribe();

notificationChannel = supabase
.channel("campusora-nav-notifications-" + user.id)
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "notifications",
filter: "recipient_id=eq." + user.id
},
() => {
refreshBadges();
}
)
.subscribe();

await refreshBadges();

} catch (error) {
console.error("Campusora live badges error:", error);
}
}

/* START BADGES */

setupBadgeRealtime();

if (badgeTimer) clearInterval(badgeTimer);

badgeTimer = setInterval(() => {
refreshBadges();
}, 60000);

document.addEventListener("visibilitychange", () => {
if (!document.hidden) refreshBadges();
});

/* =================================
GLOBAL SEARCH ENGINE
================================= */

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
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#202943"/><circle cx="50" cy="37" r="19" fill="#7785a8"/><path d="M15 100c2-24 16-36 35-36s33 12 35 36" fill="#7785a8"/></svg>`
)
);

avatar.onerror = () => {
avatar.onerror = null;
avatar.src =
"data:image/svg+xml;charset=UTF-8," +
encodeURIComponent(
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#202943"/></svg>`
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

/* SEARCH PEOPLE */

async function searchPeople(supabase, pattern) {
const [names, usernames] = await Promise.all([
supabase.from("profiles")
.select("id,username,full_name,school,avatar_url")
.ilike("full_name", pattern).limit(5),

supabase.from("profiles")
.select("id,username,full_name,school,avatar_url")
.ilike("username", pattern).limit(5)
]);

if (names.error) throw names.error;
if (usernames.error) throw usernames.error;

const combined = [
...(names.data || []),
...(usernames.data || [])
];

return [...new Map(combined.map(x => [x.id, x])).values()]
.slice(0, 5);
}

/* SEARCH POSTS */

async function searchPosts(supabase, pattern) {
const { data, error } = await supabase
.from("posts")
.select("id,user_id,content,image_url,created_at")
.ilike("content", pattern)
.order("created_at", { ascending: false })
.limit(5);

if (error) throw error;
return data || [];
}

/* SEARCH VIDEOS */

async function searchVideos(supabase, pattern) {
const { data, error } = await supabase
.from("spotlight_videos")
.select("id,user_id,caption,video_url,thumbnail_url,created_at")
.ilike("caption", pattern)
.order("created_at", { ascending: false })
.limit(5);

if (error) throw error;
return data || [];
}

/* SEARCH COMMUNITIES */

async function searchCommunities(supabase, pattern) {
const [names, descriptions] = await Promise.all([
supabase.from("communities")
.select("id,name,school,description")
.ilike("name", pattern).limit(5),

supabase.from("communities")
.select("id,name,school,description")
.ilike("description", pattern).limit(5)
]);

if (names.error) throw names.error;
if (descriptions.error) throw descriptions.error;

const combined = [
...(names.data || []),
...(descriptions.data || [])
];

return [...new Map(combined.map(x => [x.id, x])).values()]
.slice(0, 5);
}

/* AUTHOR DETAILS */

async function getProfiles(supabase, ids) {
const uniqueIds = [...new Set(ids.filter(Boolean))];

if (!uniqueIds.length) return {};

const { data, error } = await supabase
.from("profiles")
.select("id,full_name,username,avatar_url")
.in("id", uniqueIds);

if (error) throw error;

return Object.fromEntries(
(data || []).map(profile => [profile.id, profile])
);
}

/* DISPLAY SEARCH RESULTS */

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

items.forEach(item => section.appendChild(item));
searchResults.appendChild(section);
}

async function renderSearchResults(supabase, results, requestNumber) {
if (requestNumber !== searchRequest) return;

searchResults.replaceChildren();

const people = results.people || [];
const posts = results.posts || [];
const videos = results.videos || [];
const communities = results.communities || [];

const [postProfiles, videoProfiles] = await Promise.all([
getProfiles(supabase, posts.map(x => x.user_id)),
getProfiles(supabase, videos.map(x => x.user_id))
]);

if (requestNumber !== searchRequest) return;

addSection(
categoryNames.people,
people.map(user => createResult(
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
const preview = (post.content || "Shared a post").trim();

return createResult(
preview.length > 75 ? preview.slice(0, 75) + "..." : preview,
"By " + (author.full_name || author.username || "Campusora member"),
"home-feed.html#post-" + encodeURIComponent(post.id),
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
"By " + (author.full_name || author.username || "Campusora creator"),
"spotlight.html?video=" + encodeURIComponent(video.id),
video.thumbnail_url || author.avatar_url,
"video"
);
})
);

addSection(
categoryNames.communities,
communities.map(community => createResult(
community.name || "Campus community",
[
community.school || "",
community.description || ""
].filter(Boolean).join(" · ").slice(0, 100),
"communities.html?community=" + encodeURIComponent(community.id),
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

/* RUN SEARCH */

async function searchCampusora(term) {
const requestNumber = ++searchRequest;

showMessage("Searching Campusora...");

try {
const supabase = await getSupabase();
const pattern = "%" + term + "%";

const [people, posts, videos, communities] = await Promise.all([
searchPeople(supabase, pattern),
searchPosts(supabase, pattern),
searchVideos(supabase, pattern),
searchCommunities(supabase, pattern)
]);

if (requestNumber !== searchRequest) return;

await renderSearchResults(
supabase,
{ people, posts, videos, communities },
requestNumber
);

} catch (error) {
if (requestNumber !== searchRequest) return;

console.error("Campusora search error:", error);
showMessage("Search is temporarily unavailable. Please try again.");
}
}

/* SEARCH EVENTS */

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

if (term.length >= 2) searchCampusora(term);
});

searchInput.addEventListener("focus", () => {
const term = searchInput.value.trim();

if (term.length >= 2) searchCampusora(term);
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
