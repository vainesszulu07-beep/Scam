
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

export const config = {
    api: {
        bodyParser: false
    }
};

// =====================================
// MULTER CONFIGURATION
// =====================================

const upload = multer({
    dest: "/tmp/",
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    }
});

function multerMiddleware(req, res) {
    return new Promise((resolve, reject) => {

        upload.single("file")(req, res, (err) => {

            if (err) {
                return reject(err);
            }

            resolve(req.file);

        });
    });
}

// =====================================
// BACKEND HANDLER
// =====================================

export default async function handler(req, res) {

    let file;

    try {

        // 1. CHECK REQUEST METHOD

        if (req.method !== "POST") {

            return res.status(405).json({
                success: false,
                error: "Method not allowed. Use POST."
            });

        }

        // 2. CHECK ENVIRONMENT VARIABLES

        const requiredVariables = [
            "SUPABASE_URL",
            "SUPABASE_SECRET_KEY",
            "CLOUDINARY_CLOUD_NAME",
            "CLOUDINARY_API_KEY",
            "CLOUDINARY_API_SECRET"
        ];

        const missingVariables = requiredVariables.filter(name => {
            const value = process.env[name];

            return (
                typeof value !== "string" ||
                value.trim() === ""
            );
        });

        // Print missing variables in Vercel logs

        if (missingVariables.length > 0) {

            console.error(
                "MISSING ENVIRONMENT VARIABLES:",
                missingVariables
            );

            return res.status(500).json({

                success: false,

                stage: "ENVIRONMENT_CONFIGURATION",

                error: "Missing environment variables",

                missing_count: missingVariables.length,

                missing_variables: missingVariables,

                message:
                    "Add the listed variables in Vercel Project Settings > Environment Variables, then redeploy."

            });

        }

        // 3. INITIALIZE SUPABASE

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SECRET_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // 4. CONFIGURE CLOUDINARY

        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        // 5. RECEIVE IMAGE

        file = await multerMiddleware(req, res);

        if (!file) {

            return res.status(400).json({
                success: false,
                stage: "FILE_UPLOAD",
                error: "No file uploaded"
            });

        }

        // 6. GET USER ID

        const userId = req.body?.user_id;

        if (!userId) {

            return res.status(400).json({
                success: false,
                stage: "USER_VERIFICATION",
                error: "Missing user_id in form data"
            });

        }

        // 7. VERIFY DASHBOARD USER

        const {
            data: dashboardUser,
            error: dbError
        } = await supabase
            .from("dashboard")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (dbError) {

            console.error("SUPABASE ERROR:", dbError);

            return res.status(500).json({

                success: false,

                stage: "SUPABASE_VERIFICATION",

                error: dbError.message,

                details: dbError.details,

                code: dbError.code

            });

        }

        if (!dashboardUser) {

            return res.status(403).json({

                success: false,

                stage: "USER_VERIFICATION",

                error: "User ID not registered in dashboard"

            });

        }

        // 8. GENERATE ADVERTISEMENT ID

        const publicId = `ad_${userId}_${Date.now()}`;

        // 9. UPLOAD TO CLOUDINARY

        const result = await cloudinary.uploader.upload(
            file.path,
            {
                folder: "ads",

                public_id: publicId,

                overwrite: false,

                invalidate: true,

                transformation: [
                    {
                        width: 800,
                        height: 800,
                        crop: "limit"
                    },
                    {
                        quality: "auto"
                    },
                    {
                        fetch_format: "auto"
                    }
                ]
            }
        );

        // 10. RETURN SUCCESS

        return res.status(200).json({

            success: true,

            message: "Advertisement uploaded successfully",

            url: result.secure_url,

            publicId: result.public_id,

            userId: userId

        });

    } catch (err) {

        console.error("ADVERTISEMENT UPLOAD FAILURE:", err);

        const isFileTooLarge =
            err.code === "LIMIT_FILE_SIZE";

        return res.status(isFileTooLarge ? 413 : 500).json({

            success: false,

            stage: "BACKEND_EXECUTION",

            error: err.message || "Unknown server error",

            errorName: err.name || "Error",

            errorCode: err.code || null

        });

    } finally {

        // 11. DELETE TEMPORARY FILE

        if (file?.path) {

            await fs.promises.unlink(file.path).catch(err => {

                console.error(
                    "TEMP FILE CLEANUP ERROR:",
                    err.message
                );

            });

        }

    }

}
