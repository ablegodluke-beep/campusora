const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = {
  users: {
    table: "profiles",
    key: "id",
    select: "id,username,full_name,bio,school,role,avatar_url,cover_url,institution_id,created_at",
    order: "created_at"
  },

  reports: {
    table: "content_reports",
    key: "id",
    select: "id,reporter_id,reported_user_id,content_type,content_id,reason,details,status,admin_note,reviewed_by,reviewed_at,created_at",
    order: "created_at"
  },

  deletions: {
    table: "account_lifecycle",
    key: "user_id",
    select: "user_id,status,deletion_requested_at,delete_after,updated_at",
    order: "updated_at"
  },

  applications: {
    table: "creator_reward_applications",
    key: "id",
    select: "id,user_id,full_name,email,country,application_status,review_notes,reviewed_by,reviewed_at,created_at,updated_at",
    order: "created_at"
  },

  creatorEarnings: {
    table: "creator_reward_earnings",
    key: "id",
    select: "id,creator_id,period_start,period_end,post_views,video_views,qualifying_views,amount_kobo,payout_status,payout_reference,paid_at,created_at",
    order: "created_at"
  },

  creatorPayouts: {
    table: "creator_reward_payouts",
    key: "id",
    select: "id,creator_id,amount_kobo,payout_method,payout_reference,payout_status,admin_notes,created_at,paid_at",
    order: "created_at"
  },

  giftPayouts: {
    table: "campusora_gift_payout_requests",
    key: "id",
    select: "id,creator_id,amount,currency,payout_method,account_name,bank_name,status,admin_note,payment_reference,requested_at,processed_at,updated_at,rejection_reason,external_transfer_reference,reviewed_at,reviewed_by,payout_period_id",
    order: "requested_at"
  },

  giftPayments: {
    table: "campusora_gift_payments",
    key: "id",
    select: "id,user_id,amount_kobo,status,paid_at,payment_reference,payment_mode,created_at",
    order: "created_at"
  },

  premium: {
    table: "premium_memberships",
    key: "id",
    select: "id,user_id,plan_type,amount_kobo,payment_reference,payment_verified,payment_mode,status,starts_at,expires_at,created_at",
    order: "created_at"
  },

  ranks: {
    table: "profile_ranks",
    key: "id",
    select: "id,user_id,rank_type,amount_kobo,payment_reference,payment_verified,payment_mode,status,created_at",
    order: "created_at"
  },

  campaigns: {
    table: "sponsored_campaigns",
    key: "id",
    select: "id,user_id,post_content,post_image_url,post_video_url,destination_url,contact_method,whatsapp_number,duration_days,amount_kobo,estimated_reach,actual_impressions,clicks,status,payment_reference,payment_verified,payment_mode,admin_note,starts_at,ends_at,created_at,published_at,expires_at",
    order: "created_at"
  },

  promotions: {
    table: "campusora_business_promotions",
    key: "id",
    select: "id,business_name,promotion_title,description,media_type,media_path,phone_number,whatsapp_url,website_url,social_media_url,call_to_action,placement,status,start_at,end_at,priority,created_by,created_at,updated_at",
    order: "created_at"
  },

  communities: {
    table: "communities",
    key: "id",
    select: "id,name,description,school,created_by,created_at",
    order: "created_at"
  },

  events: {
    table: "events",
    key: "id",
    select: "id,organizer_id,title,description,category,poster_url,start_time,end_time,location,institution,is_online,online_url,visibility,price_type,ticket_url,status,created_at,updated_at",
    order: "created_at"
  },

  products: {
    table: "products",
    key: "id",
    select: "id,seller_id,name,description,price,category,condition,location,image_urls,status,created_at,updated_at",
    order: "created_at"
  },

  listings: {
    table: "marketplace_listings",
    key: "id",
    select: "id,seller_id,title,description,price,listing_type,category,condition,image_urls,location,status,created_at",
    order: "created_at"
  },

  marketplaceReports: {
    table: "marketplace_reports",
    key: "id",
    select: "*",
    order: "created_at"
  },

  activity: {
    table: "campusora_admin_activity",
    key: "id",
    select: "id,admin_id,action,target_type,target_id,details,created_at",
    order: "created_at"
  },

  restrictions: {
    table: "campusora_account_restrictions",
    key: "id",
    select: "id,user_id,restriction_type,reason,starts_at,ends_at,is_active,created_by,lifted_by,lifted_at,created_at",
    order: "created_at"
  }
};

const EDITABLE = {
  reports: [
    "status",
    "admin_note"
  ],

  applications: [
    "application_status",
    "review_notes"
  ],

  creatorPayouts: [
    "payout_status",
    "admin_notes",
    "payout_reference",
    "paid_at"
  ],

  campaigns: [
    "status",
    "admin_note",
    "starts_at",
    "ends_at",
    "expires_at"
  ],

  promotions: [
    "business_name",
    "promotion_title",
    "description",
    "media_type",
    "media_path",
    "phone_number",
    "whatsapp_url",
    "website_url",
    "social_media_url",
    "call_to_action",
    "placement",
    "status",
    "start_at",
    "end_at",
    "priority"
  ],

  communities: [
    "name",
    "description",
    "school"
  ],

  events: [
    "status"
  ],

  products: [
    "status"
  ],

  listings: [
    "status"
  ],

  marketplaceReports: [
    "status"
  ]
};

const REPORT_STATUSES = [
  "pending",
  "reviewing",
  "resolved",
  "dismissed"
];

const RESTRICTION_TYPES = [
  "warning",
  "temporary_restriction",
  "temporary_suspension",
  "permanent_suspension"
];

const PROMOTION_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "expired",
  "archived"
];

function errorResponse(res, status, message) {
  return res.status(status).json({
    success: false,
    message
  });
}

function safeText(value, max = 5000) {
  return String(value || "").trim().slice(0, max);
}

function isValidDate(value) {
  return value && !Number.isNaN(Date.parse(value));
}

function restUrl(path) {
  return SUPABASE_URL + "/rest/v1/" + path;
}

async function database(path, options = {}) {
  const response = await fetch(restUrl(path), {
    ...options,

    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("Admin database error:", text);

    throw new Error(
      "Database operation failed. Check the requested action and database constraints."
    );
  }

  return text ? JSON.parse(text) : [];
}

async function verifyAdmin(req) {
  const authorization = req.headers.authorization || "";

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    const error = new Error("Please log in.");
    error.status = 401;
    throw error;
  }

  const response = await fetch(
    SUPABASE_URL + "/auth/v1/user",
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + token
      }
    }
  );

  const user = await response.json().catch(() => ({}));

  if (!response.ok || !user.id) {
    const error = new Error("Your login session is invalid.");
    error.status = 401;
    throw error;
  }

  const admins = await database(
    "campusora_admins?user_id=eq." +
    encodeURIComponent(user.id) +
    "&select=user_id,admin_role,permissions"
  );

  if (
    !admins.length ||
    !["admin", "super_admin"].includes(admins[0].admin_role)
  ) {
    const error = new Error("Administrator access required.");
    error.status = 403;
    throw error;
  }

  return {
    user,
    admin: admins[0]
  };
}

async function logActivity(adminId, action, targetType, targetId, details = {}) {
  try {
    await database("campusora_admin_activity", {
      method: "POST",

      headers: {
        Prefer: "return=minimal"
      },

      body: JSON.stringify({
        admin_id: adminId,
        action,
        target_type: targetType,
        target_id: String(targetId || ""),
        details
      })
    });
  } catch (error) {
    console.error("Activity log error:", error.message);
  }
}

function requireSuperAdmin(admin) {
  if (admin.admin_role !== "super_admin") {
    const error = new Error(
      "Only the super administrator can perform this action."
    );

    error.status = 403;
    throw error;
  }
}

async function getAdminUsers() {
  const admins = await database(
    "campusora_admins?select=user_id,admin_role,permissions,created_at&order=created_at.asc"
  );

  const response = await fetch(
    SUPABASE_URL + "/auth/v1/admin/users?page=1&per_page=100",
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY
      }
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error("Could not load administrator email addresses.");
  }

  const users = result.users || [];

  return admins.map(admin => {
    const user = users.find(
      item => item.id === admin.user_id
    );

    return {
      user_id: admin.user_id,
      email: user?.email || "Email unavailable",
      admin_role: admin.admin_role,
      permissions: admin.permissions,
      created_at: admin.created_at
    };
  });
}

async function findExistingAuthUser(email) {
  const wanted = email.toLowerCase();

  for (let page = 1; page <= 10; page++) {
    const response = await fetch(
      SUPABASE_URL +
      "/auth/v1/admin/users?page=" +
      page +
      "&per_page=100",
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: "Bearer " + SERVICE_KEY
        }
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error("Could not search existing Campusora users.");
    }

    const users = result.users || [];

    const match = users.find(
      user => String(user.email || "").toLowerCase() === wanted
    );

    if (match) return match;

    if (users.length < 100) break;
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return errorResponse(
      res,
      500,
      "Admin service is not configured."
    );
  }

  try {
    const { user, admin } = await verifyAdmin(req);

    // GET: Load records.
    if (req.method === "GET") {
      const section = safeText(req.query.section, 60);

      if (section === "admins") {
        const data = await getAdminUsers();

        return res.status(200).json({
          success: true,
          section,
          count: data.length,
          data
        });
      }

      const config = TABLES[section];

      if (!config) {
        return errorResponse(res, 400, "Unknown management section.");
      }

      const limit = Math.min(
        100,
        Math.max(1, Number(req.query.limit) || 50)
      );

      const offset = Math.max(
        0,
        Number(req.query.offset) || 0
      );

      let path =
        config.table +
        "?select=" + encodeURIComponent(config.select) +
        "&order=" + config.order + ".desc" +
        "&limit=" + limit +
        "&offset=" + offset;

      // Only show campaigns with confirmed real LIVE payments.
      if (section === "campaigns") {
        path +=
          "&payment_verified=eq.true" +
          "&payment_mode=eq.live";
      }

      // Only show genuine LIVE gift payments.
      if (section === "giftPayments") {
        path += "&payment_mode=eq.live";
      }

      // Search profiles.
      if (section === "users" && req.query.search) {
        const term = safeText(req.query.search, 80)
          .replace(/[(),.*]/g, " ")
          .trim();

        if (term) {
          path +=
            "&or=(username.ilike.*" +
            encodeURIComponent(term) +
            "*,full_name.ilike.*" +
            encodeURIComponent(term) +
            "*,school.ilike.*" +
            encodeURIComponent(term) +
            "*)";
        }
      }

      const data = await database(path);

      return res.status(200).json({
        success: true,
        section,
        count: data.length,
        data
      });
    }

    // POST: Perform management actions.
    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};

      const section = safeText(body.section, 60);
      const operation = safeText(body.operation, 60);
      const id = safeText(body.id, 120);

      // Add an existing Campusora user as a helper admin.
      if (operation === "add_admin") {
        requireSuperAdmin(admin);

        const email = safeText(body.email, 200).toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return errorResponse(res, 400, "Enter a valid email address.");
        }

        const existingUser = await findExistingAuthUser(email);

        if (!existingUser) {
          return errorResponse(
            res,
            404,
            "No existing Campusora account was found with that email."
          );
        }

        const alreadyAdmin = await database(
          "campusora_admins?user_id=eq." +
          encodeURIComponent(existingUser.id) +
          "&select=user_id"
        );

        if (alreadyAdmin.length) {
          return errorResponse(res, 409, "This user is already an administrator.");
        }

        await database("campusora_admins", {
          method: "POST",

          headers: {
            Prefer: "return=minimal"
          },

          body: JSON.stringify({
            user_id: existingUser.id,
            admin_role: "admin",
            permissions: {}
          })
        });

        await logActivity(
          user.id,
          "add_helper_admin",
          "campusora_admins",
          existingUser.id,
          { email }
        );

        return res.status(200).json({
          success: true,
          message: "Existing Campusora user added as a helper admin."
        });
      }

      // Remove a helper admin.
      if (operation === "remove_admin") {
        requireSuperAdmin(admin);

        if (!id) {
          return errorResponse(res, 400, "Admin user ID is required.");
        }

        if (id === user.id) {
          return errorResponse(res, 400, "You cannot remove yourself.");
        }

        const target = await database(
          "campusora_admins?user_id=eq." +
          encodeURIComponent(id) +
          "&select=user_id,admin_role"
        );

        if (!target.length) {
          return errorResponse(res, 404, "Administrator not found.");
        }

        if (target[0].admin_role === "super_admin") {
          return errorResponse(
            res,
            403,
            "A super administrator cannot be removed through this action."
          );
        }

        await database(
          "campusora_admins?user_id=eq." +
          encodeURIComponent(id),
          {
            method: "DELETE",
            headers: {
              Prefer: "return=minimal"
            }
          }
        );

        await logActivity(
          user.id,
          "remove_helper_admin",
          "campusora_admins",
          id
        );

        return res.status(200).json({
          success: true,
          message: "Helper administrator removed."
        });
      }

      // Keep an account that requested deletion.
      if (operation === "keep_account" && section === "deletions") {
        if (!id) {
          return errorResponse(res, 400, "User ID is required.");
        }

        const rows = await database(
          "account_lifecycle?user_id=eq." +
          encodeURIComponent(id) +
          "&select=user_id,status",
          {
            method: "PATCH",

            headers: {
              Prefer: "return=representation"
            },

            body: JSON.stringify({
              status: "active",
              deletion_requested_at: null,
              delete_after: null,
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!rows.length) {
          return errorResponse(res, 404, "Account lifecycle record not found.");
        }

        await logActivity(
          user.id,
          "keep_account",
          "account_lifecycle",
          id
        );

        return res.status(200).json({
          success: true,
          message: "Account deletion request cancelled. Account kept."
        });
      }

      // Record a user restriction.
      if (operation === "restrict_user" && section === "users") {
        const type = safeText(body.restriction_type, 60);
        const reason = safeText(body.reason, 1000);
        const endsAt = body.ends_at || null;

        if (!id || !RESTRICTION_TYPES.includes(type) || !reason) {
          return errorResponse(
            res,
            400,
            "Provide a valid user, restriction type and reason."
          );
        }

        if (
          ["temporary_restriction", "temporary_suspension"].includes(type) &&
          (!isValidDate(endsAt) || Date.parse(endsAt) <= Date.now())
        ) {
          return errorResponse(
            res,
            400,
            "A temporary restriction or suspension needs a future end date."
          );
        }

        const rows = await database(
          "campusora_account_restrictions",
          {
            method: "POST",

            headers: {
              Prefer: "return=representation"
            },

            body: JSON.stringify({
              user_id: id,
              restriction_type: type,
              reason,
              starts_at: new Date().toISOString(),
              ends_at: endsAt,
              is_active: true,
              created_by: user.id
            })
          }
        );

        await logActivity(
          user.id,
          "restrict_user",
          "profiles",
          id,
          { restriction_type: type, reason }
        );

        return res.status(200).json({
          success: true,
          message: "Account restriction recorded.",
          data: rows[0]
        });
      }

      // Lift a restriction.
      if (operation === "lift_restriction" && section === "restrictions") {
        if (!id) {
          return errorResponse(res, 400, "Restriction ID is required.");
        }

        const rows = await database(
          "campusora_account_restrictions?id=eq." +
          encodeURIComponent(id) +
          "&is_active=eq.true&select=id",
          {
            method: "PATCH",

            headers: {
              Prefer: "return=representation"
            },

            body: JSON.stringify({
              is_active: false,
              lifted_by: user.id,
              lifted_at: new Date().toISOString()
            })
          }
        );

        if (!rows.length) {
          return errorResponse(res, 404, "Active restriction not found.");
        }

        await logActivity(
          user.id,
          "lift_restriction",
          "campusora_account_restrictions",
          id
        );

        return res.status(200).json({
          success: true,
          message: "Restriction lifted."
        });
      }

      // Create a Business Promotion.
      if (operation === "create_promotion" && section === "promotions") {
        const promotion = {
          business_name: safeText(body.business_name, 200),
          promotion_title: safeText(body.promotion_title, 200),
          description: safeText(body.description, 5000),
          media_type: safeText(body.media_type, 20) || "image",
          media_path: safeText(body.media_path, 1000) || null,
          phone_number: safeText(body.phone_number, 50) || null,
          whatsapp_url: safeText(body.whatsapp_url, 1000) || null,
          website_url: safeText(body.website_url, 1000) || null,
          social_media_url: safeText(body.social_media_url, 1000) || null,
          call_to_action: safeText(body.call_to_action, 100) || "Contact Business",
          placement: safeText(body.placement, 20) || "feed",
          status: safeText(body.status, 30) || "draft",
          start_at: body.start_at || null,
          end_at: body.end_at || null,
          priority: Number.isFinite(Number(body.priority))
            ? Number(body.priority)
            : 0,
          created_by: user.id,
          updated_at: new Date().toISOString()
        };

        if (
          !promotion.business_name ||
          !promotion.promotion_title ||
          !promotion.description
        ) {
          return errorResponse(
            res,
            400,
            "Business name, promotion title and description are required."
          );
        }

        if (!["image", "video"].includes(promotion.media_type)) {
          return errorResponse(res, 400, "Media type must be image or video.");
        }

        if (!["top", "feed", "both"].includes(promotion.placement)) {
          return errorResponse(res, 400, "Invalid promotion placement.");
        }

        if (!PROMOTION_STATUSES.includes(promotion.status)) {
          return errorResponse(res, 400, "Invalid promotion status.");
        }

        if (
          promotion.start_at &&
          !isValidDate(promotion.start_at)
        ) {
          return errorResponse(res, 400, "Invalid promotion start date.");
        }

        if (
          promotion.end_at &&
          !isValidDate(promotion.end_at)
        ) {
          return errorResponse(res, 400, "Invalid promotion end date.");
        }

        if (
          promotion.start_at &&
          promotion.end_at &&
          Date.parse(promotion.end_at) <= Date.parse(promotion.start_at)
        ) {
          return errorResponse(
            res,
            400,
            "Promotion end date must be after its start date."
          );
        }

        const rows = await database(
          "campusora_business_promotions",
          {
            method: "POST",

            headers: {
              Prefer: "return=representation"
            },

            body: JSON.stringify(promotion)
          }
        );

        await logActivity(
          user.id,
          "create_business_promotion",
          "campusora_business_promotions",
          rows[0]?.id,
          { business_name: promotion.business_name }
        );

        return res.status(200).json({
          success: true,
          message: "Business promotion created.",
          data: rows[0]
        });
      }

      // Archive a Business Promotion instead of permanently deleting it.
      if (operation === "archive_promotion" && section === "promotions") {
        if (!id) {
          return errorResponse(res, 400, "Promotion ID is required.");
        }

        const rows = await database(
          "campusora_business_promotions?id=eq." +
          encodeURIComponent(id) +
          "&select=id,status",
          {
            method: "PATCH",

            headers: {
              Prefer: "return=representation"
            },

            body: JSON.stringify({
              status: "archived",
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!rows.length) {
          return errorResponse(res, 404, "Promotion not found.");
        }

        await logActivity(
          user.id,
          "archive_business_promotion",
          "campusora_business_promotions",
          id
        );

        return res.status(200).json({
          success: true,
          message: "Business promotion archived."
        });
      }

      // Update permitted fields.
      if (operation === "update") {
        const config = TABLES[section];
        const allowed = EDITABLE[section];

        if (!config || !allowed || !id) {
          return errorResponse(res, 400, "Invalid update request.");
        }

        if (
          !body.changes ||
          typeof body.changes !== "object" ||
          Array.isArray(body.changes)
        ) {
          return errorResponse(res, 400, "Invalid changes object.");
        }

        const changes = {};

        for (const field of allowed) {
          if (
            Object.prototype.hasOwnProperty.call(body.changes, field)
          ) {
            changes[field] = body.changes[field];
          }
        }

        if (!Object.keys(changes).length) {
          return errorResponse(res, 400, "No permitted fields supplied.");
        }

        if (
          section === "reports" &&
          changes.status &&
          !REPORT_STATUSES.includes(changes.status)
        ) {
          return errorResponse(res, 400, "Invalid report status.");
        }

        if (
          section === "campaigns" &&
          changes.status &&
          ![
            "pending_payment",
            "pending_review",
            "active",
            "paused",
            "rejected",
            "completed",
            "cancelled"
          ].includes(changes.status)
        ) {
          return errorResponse(res, 400, "Invalid campaign status.");
        }

        if (
          section === "promotions" &&
          changes.status &&
          !PROMOTION_STATUSES.includes(changes.status)
        ) {
          return errorResponse(res, 400, "Invalid promotion status.");
        }

        if (
          section === "promotions" &&
          changes.media_type &&
          !["image", "video"].includes(changes.media_type)
        ) {
          return errorResponse(res, 400, "Invalid media type.");
        }

        if (
          section === "promotions" &&
          changes.placement &&
          !["top", "feed", "both"].includes(changes.placement)
        ) {
          return errorResponse(res, 400, "Invalid placement.");
        }

        if (section === "promotions") {
          changes.updated_at = new Date().toISOString();
        }

        if (section === "giftPayouts") {
          // Do not permit generic payout settlement.
          const forbidden = [
            "status",
            "processed_at",
            "payment_reference",
            "external_transfer_reference",
            "rejection_reason"
          ];

          if (forbidden.some(field =>
            Object.prototype.hasOwnProperty.call(changes, field)
          )) {
            return errorResponse(
              res,
              400,
              "Gift payout status and settlement require a dedicated verified payout workflow. This generic update is disabled."
            );
          }
        }

        if (
          section === "creatorPayouts" &&
          changes.payout_status === "paid" &&
          !body.confirm_actual_transfer
        ) {
          return errorResponse(
            res,
            400,
            "Confirm that the actual bank transfer has succeeded before marking paid."
          );
        }

        if (section === "applications") {
          changes.reviewed_by = user.id;
          changes.reviewed_at = new Date().toISOString();
        }

        if (section === "reports") {
          changes.reviewed_by = user.id;
          changes.reviewed_at = new Date().toISOString();
        }

        const rows = await database(
          config.table +
          "?" + config.key + "=eq." +
          encodeURIComponent(id) +
          "&select=" + encodeURIComponent(config.select),
          {
            method: "PATCH",

            headers: {
              Prefer: "return=representation"
            },

            body: JSON.stringify(changes)
          }
        );

        if (!rows.length) {
          return errorResponse(res, 404, "Record not found.");
        }

        await logActivity(
          user.id,
          "update",
          config.table,
          id,
          changes
        );

        return res.status(200).json({
          success: true,
          message: "Record updated.",
          data: rows[0]
        });
      }

      return errorResponse(
        res,
        400,
        "Unsupported management operation."
      );
    }

    res.setHeader("Allow", "GET, POST");

    return errorResponse(res, 405, "Method not allowed.");

  } catch (error) {
    console.error("Admin management error:", error);

    return errorResponse(
      res,
      error.status || 500,
      error.status
        ? error.message
        : "Admin request failed."
    );
  }
};
