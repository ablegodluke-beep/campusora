const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = "campusora-business-promotions";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

function respond(res, status, data) {
  return res.status(status).json(data);
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

  const userResponse = await fetch(
    SUPABASE_URL + "/auth/v1/user",
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + token
      }
    }
  );

  const user = await userResponse.json().catch(() => ({}));

  if (!userResponse.ok || !user.id) {
    const error = new Error("Your login session is invalid.");
    error.status = 401;
    throw error;
  }

  const adminResponse = await fetch(
    SUPABASE_URL +
      "/rest/v1/campusora_admins?user_id=eq." +
      encodeURIComponent(user.id) +
      "&select=user_id,admin_role",
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY
      }
    }
  );

  const admins = await adminResponse.json().catch(() => []);

  if (
    !adminResponse.ok ||
    !Array.isArray(admins) ||
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

module.exports = async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return respond(res, 500, {
        success: false,
        message: "Server configuration is incomplete."
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");

      return respond(res, 405, {
        success: false,
        message: "Method not allowed."
      });
    }

    const { user, admin } = await verifyAdmin(req);

    const contentType = String(
      req.body?.contentType || ""
    ).toLowerCase();

    const fileSize = Number(req.body?.fileSize);

    const extension = ALLOWED_TYPES[contentType];

    if (!extension) {
      return respond(res, 400, {
        success: false,
        message: "This file type is not allowed."
      });
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_FILE_SIZE
    ) {
      return respond(res, 400, {
        success: false,
        message: "File must be smaller than 50 MB."
      });
    }

    const filePath =
      "promotions/" +
      user.id +
      "/" +
      crypto.randomUUID() +
      "." +
      extension;

    const storageUrl =
      SUPABASE_URL +
      "/storage/v1/object/upload/sign/" +
      BUCKET +
      "/" +
      filePath
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    const uploadResponse = await fetch(storageUrl, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const uploadData = await uploadResponse
      .json()
      .catch(() => ({}));

    if (!uploadResponse.ok) {
      console.error(
        "Promotion upload URL error:",
        uploadData
      );

      return respond(res, 500, {
        success: false,
        message: "Could not prepare the file upload."
      });
    }

    const returnedUrl =
      uploadData.url ||
      uploadData.signedURL ||
      uploadData.signedUrl ||
      "";

    let uploadToken = uploadData.token || "";

    if (!uploadToken && returnedUrl) {
      try {
        const parsedUrl = new URL(
          returnedUrl,
          SUPABASE_URL
        );

        uploadToken =
          parsedUrl.searchParams.get("token") || "";
      } catch (error) {
        uploadToken = "";
      }
    }

    if (!uploadToken) {
      console.error(
        "Supabase did not return an upload token."
      );

      return respond(res, 500, {
        success: false,
        message: "Could not prepare the secure upload."
      });
    }

    const publicUrl =
      SUPABASE_URL +
      "/storage/v1/object/public/" +
      BUCKET +
      "/" +
      filePath
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    return respond(res, 200, {
      success: true,
      message: "Secure upload prepared.",
      path: filePath,
      token: uploadToken,
      contentType,
      publicUrl,
      adminRole: admin.admin_role
    });

  } catch (error) {
    console.error(
      "Admin upload error:",
      error
    );

    return respond(res, error.status || 500, {
      success: false,
      message: error.status
        ? error.message
        : "Could not prepare the upload."
    });
  }
};
