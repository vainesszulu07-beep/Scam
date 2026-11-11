
import cloudinary from "cloudinary";
import { createClient } from "@supabase/supabase-js";

const cloud = cloudinary.v2;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Use POST"
        });
    }

    try {
        // Environment variables
        const {
            SUPABASE_URL,
            SUPABASE_SECRET_KEY,
            CLOUDINARY_CLOUD_NAME,
            CLOUDINARY_API_KEY,
            CLOUDINARY_API_SECRET
        } = process.env;

        const missing = [
            ["SUPABASE_URL", SUPABASE_URL],
            ["SUPABASE_SECRET_KEY", SUPABASE_SECRET_KEY],
            ["CLOUDINARY_CLOUD_NAME", CLOUDINARY_CLOUD_NAME],
            ["CLOUDINARY_API_KEY", CLOUDINARY_API_KEY],
            ["CLOUDINARY_API_SECRET", CLOUDINARY_API_SECRET]
        ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

        if (missing.length) {
            return res.status(500).json({
                success: false,
                error: "Missing environment variables",
                missing
            });
        }

        // Parse request
        let body = req.body || {};

        if (typeof body === "string") {
            body = JSON.parse(body);
        }

        const { action, user_id, row_id, secure_url } = body;

        if (
            typeof user_id !== "string" ||
            !user_id.trim() ||
            typeof row_id !== "string" ||
            !row_id.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "user_id and row_id are required"
            });
        }

        const userId = user_id.trim();
        const rowId = row_id.trim();

        // Supabase server-side client
        const supabase = createClient(
            SUPABASE_URL,
            SUPABASE_SECRET_KEY,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );

        // Verify user exists in dashboard
        const { data: user, error: userError } =
            await supabase
                .from("dashboard")
                .select("user_id")
                .eq("user_id", userId)
                .maybeSingle();

        if (userError) {
            throw userError;
        }

        if (!user) {
            return res.status(403).json({
                success: false,
                error: "User ID is not registered in dashboard"
            });
        }

        // Verify requested ad row exists
        const { data: ad, error: adError } =
            await supabase
                .from("ad_table")
                .select("id")
                .eq("id", rowId)
                .maybeSingle();

        if (adError) {
            throw adError;
        }

        if (!ad) {
            return res.status(404).json({
                success: false,
                error: "Advertisement row ID does not exist"
            });
        }

        // Configure Cloudinary
        cloud.config({
            cloud_name: CLOUDINARY_CLOUD_NAME,
            api_key: CLOUDINARY_API_KEY,
            api_secret: CLOUDINARY_API_SECRET
        });

        // =====================================
        // ACTION 1: GENERATE UPLOAD SIGNATURE
        // =====================================

        if (action === "sign") {
            const timestamp = Math.floor(Date.now() / 1000);
            const folder = "videos";

            const signature = cloud.utils.api_sign_request(
                {
                    folder,
                    timestamp
                },
                CLOUDINARY_API_SECRET
            );

            return res.status(200).json({
                success: true,
                signature,
                timestamp,
                folder,
                apiKey: CLOUDINARY_API_KEY,
                cloudName: CLOUDINARY_CLOUD_NAME,
                uploadUrl:
                    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
                row_id: rowId
            });
        }

        // =====================================
        // ACTION 2: SAVE CLOUDINARY VIDEO URL
        // =====================================

        if (action === "save") {
            if (
                typeof secure_url !== "string" ||
                !secure_url.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    error: "Cloudinary secure_url is required"
                });
            }

            // Accept only HTTPS URLs from this Cloudinary account
            let parsedUrl;

            try {
                parsedUrl = new URL(secure_url.trim());
            } catch {
                return res.status(400).json({
                    success: false,
                    error: "Invalid video URL"
                });
            }

            if (
                parsedUrl.protocol !== "https:" ||
                parsedUrl.hostname !== "res.cloudinary.com" ||
                !parsedUrl.pathname.startsWith(
                    `/${CLOUDINARY_CLOUD_NAME}/video/upload/`
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid Cloudinary video URL"
                });
            }

            // Update only the supplied ad row
            const { data: updatedAd, error: updateError } =
                await supabase
                    .from("ad_table")
                    .update({
                        ad_url: secure_url.trim()
                    })
                    .eq("id", rowId)
                    .select("id")
                    .maybeSingle();

            if (updateError) {
                throw updateError;
            }

            if (!updatedAd) {
                return res.status(404).json({
                    success: false,
                    error: "Advertisement row could not be updated"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Video URL saved successfully",
                row_id: updatedAd.id,
                ad_url: secure_url.trim()
            });
        }

        return res.status(400).json({
            success: false,
            error: "Invalid action. Use sign or save."
        });

    } catch (error) {
        console.error("VIDEO ADS BACKEND ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Internal server error",
            details: error.message
        });
    }
}
