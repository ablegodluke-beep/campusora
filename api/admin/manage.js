const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY =
process.env.SUPABASE_PUBLISHABLE_KEY ||
process.env.SUPABASE_ANON_KEY ||
SERVICE_KEY;

const TABLES = {
users: {
table: "profiles",
key: "id",
select: "id,username,full_name,bio,school,role,avatar_url,created_at",
order: "created_at"
},
reports: {
table: "content_reports",
key: "id",
select: "",
order: "created_at"
},
deletions: {
table: "account_lifecycle",
key: "user_id",
select: "",
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
select: "",
order: "created_at"
},
creatorPayouts: {
table: "creator_reward_payouts",
key: "id",
select: "",
order: "created_at"
},
giftPayouts: {
table: "campusora_gift_payout_requests",
key: "id",
select: "id,creator_id,amount,payout_method,account_name,bank_name,status,admin_note,payment_reference,requested_at,processed_at,updated_at,currency,rejection_reason,external_transfer_reference,reviewed_at,reviewed_by,payout_period_id",
order: "requested_at"
},
premium: {
table: "premium_memberships",
key: "id",
select: "",
order: "created_at"
},
ranks: {
table: "profile_ranks",
key: "id",
select: "",
order: "created_at"
},
campaigns: {
table: "sponsored_campaigns",
key: "id",
select: "",
order: "created_at"
},
promotions: {
table: "campusora_business_promotions",
key: "id",
select: "",
order: "created_at"
},
communities: {
table: "communities",
key: "id",
select: "",
order: "created_at"
},
events: {
table: "events",
key: "id",
select: "",
order: "created_at"
},
products: {
table: "products",
key: "id",
select: "",
order: "created_at"
},
listings: {
table: "marketplace_listings",
key: "id",
select: "",
order: "created_at"
},
marketplaceReports: {
table: "marketplace_reports",
key: "id",
select: "",
order: "created_at"
},
activity: {
table: "campusora_admin_activity",
key: "id",
select: "",
order: "created_at"
},
restrictions: {
table: "campusora_account_restrictions",
key: "id",
select: "*",
order: "created_at"
}
};

const EDITABLE = {
reports: ["status", "admin_note", "reviewed_by", "reviewed_at"],
applications: [
"application_status",
"review_notes",
"reviewed_by",
"reviewed_at"
],
creatorPayouts: [
"payout_status",
"admin_notes",
"payout_reference",
"paid_at"
],
giftPayouts: [
"status",
"admin_note",
"payment_reference",
"processed_at",
"reviewed_at",
"reviewed_by",
"rejection_reason",
"external_transfer_reference"
],
campaigns: [
"status",
"admin_note",
"moderation_note",
"moderated_at",
"moderated_by",
"starts_at",
"ends_at",
"expires_at"
],
promotions: ["status", "start_at", "end_at", "priority"],
communities: ["name", "description", "school"],
events: ["status"],
products: ["status"],
listings: ["status"],
marketplaceReports: ["status"],
restrictions: ["is_active", "ends_at", "lifted_by", "lifted_at"]
};

function sendError(res, status, message) {
return res.status(status).json({
success: false,
message
});
}

async function supabaseRequest(path, options = {}) {
const response = await fetch(
SUPABASE_URL + "/rest/v1/" + path,
{
...options,
headers: {
apikey: SERVICE_KEY,
Authorization: "Bearer " + SERVICE_KEY,
"Content-Type": "application/json",
...(options.headers || {})
}
}
);

const body = await response.text();

if (!response.ok) {
console.error("Supabase request failed:", body);
throw new Error("Database request failed.");
}

return body ? JSON.parse(body) : [];
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
apikey: PUBLIC_KEY,
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

const admins = await supabaseRequest(
"campusora_admins?user_id=eq." +
encodeURIComponent(user.id) +
"&select=user_id,admin_role"
);

if (
!admins.length ||
!["admin", "super_admin"].includes(admins[0].admin_role)
) {
const error = new Error("Administrator access required.");
error.status = 403;
throw error;
}

return user;
}

async function recordActivity(adminId, action, table, targetId, details = {}) {
try {
await supabaseRequest("campusora_admin_activity", {
method: "POST",
headers: {
Prefer: "return=minimal"
},
body: JSON.stringify({
admin_id: adminId,
action,
target_type: table,
target_id: String(targetId || ""),
details
})
});
} catch (error) {
console.error("Could not record admin activity:", error.message);
}
}

module.exports = async function handler(req, res) {
res.setHeader("Cache-Control", "no-store");

if (!SUPABASE_URL || !SERVICE_KEY || !PUBLIC_KEY) {
return sendError(res, 500, "Admin service is not configured.");
}

try {
const admin = await verifyAdmin(req);

if (req.method === "GET") {
  const section = String(req.query.section || "");
  const config = TABLES[section];

  if (!config) {
    return sendError(res, 400, "Unknown management section.");
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(req.query.limit) || 50)
  );

  const offset = Math.max(
    0,
    Number(req.query.offset) || 0
  );

  const path =
    config.table +
    "?select=" + encodeURIComponent(config.select) +
    "&order=" + config.order + ".desc" +
    "&limit=" + limit +
    "&offset=" + offset;

  const rows = await supabaseRequest(path);

  return res.status(200).json({
    success: true,
    section,
    count: rows.length,
    data: rows
  });
}

if (req.method === "POST") {
  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : req.body || {};

  const section = String(body.section || "");
  const operation = String(body.operation || "");
  const id = String(body.id || "");
  const config = TABLES[section];

  if (!config) {
    return sendError(res, 400, "Unknown management section.");
  }

  if (operation === "update") {
    const allowed = EDITABLE[section];

    if (
      !allowed ||
      !id ||
      !body.changes ||
      typeof body.changes !== "object" ||
      Array.isArray(body.changes)
    ) {
      return sendError(res, 400, "Invalid update request.");
    }

    const changes = {};

    for (const field of allowed) {
      if (
        Object.prototype.hasOwnProperty.call(
          body.changes,
          field
        )
      ) {
        changes[field] = body.changes[field];
      }
    }

    if (!Object.keys(changes).length) {
      return sendError(
        res,
        400,
        "No permitted fields were supplied."
      );
    }

    const rows = await supabaseRequest(
      config.table +
      "?" + config.key + "=eq." +
      encodeURIComponent(id) +
      "&select=*",
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(changes)
      }
    );

    if (!rows.length) {
      return sendError(res, 404, "Record not found.");
    }

    await recordActivity(
      admin.id,
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

  if (operation === "restrict_user" && section === "users") {
    const restrictionType = String(
      body.restriction_type || ""
    );

    const reason = String(body.reason || "").trim();
    const endsAt = body.ends_at || null;

    if (
      !id ||
      !["warning", "temporary", "permanent"].includes(
        restrictionType
      ) ||
      !reason
    ) {
      return sendError(
        res,
        400,
        "Provide a valid restriction type and reason."
      );
    }

    const rows = await supabaseRequest(
      "campusora_account_restrictions",
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          user_id: id,
          restriction_type: restrictionType,
          reason,
          starts_at: new Date().toISOString(),
          ends_at: endsAt,
          is_active: true,
          created_by: admin.id
        })
      }
    );

    await recordActivity(
      admin.id,
      "restrict_user",
      "profiles",
      id,
      {
        restriction_type: restrictionType,
        reason
      }
    );

    return res.status(200).json({
      success: true,
      message: "Account restriction recorded.",
      data: rows[0]
    });
  }

  if (
    operation === "lift_restriction" &&
    section === "restrictions"
  ) {
    if (!id) {
      return sendError(
        res,
        400,
        "Restriction ID is required."
      );
    }

    const rows = await supabaseRequest(
      "campusora_account_restrictions?id=eq." +
      encodeURIComponent(id) +
      "&select=*",
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          is_active: false,
          lifted_by: admin.id,
          lifted_at: new Date().toISOString()
        })
      }
    );

    if (!rows.length) {
      return sendError(
        res,
        404,
        "Restriction not found."
      );
    }

    await recordActivity(
      admin.id,
      "lift_restriction",
      "campusora_account_restrictions",
      id
    );

    return res.status(200).json({
      success: true,
      message: "Restriction lifted."
    });
  }

  return sendError(
    res,
    400,
    "Unsupported management operation."
  );
}

res.setHeader("Allow", "GET, POST");

return sendError(res, 405, "Method not allowed.");

} catch (error) {
console.error("Admin management error:", error);

return sendError(
  res,
  error.status || 500,
  error.status
    ? error.message
    : "Admin request failed."
);

}
};
