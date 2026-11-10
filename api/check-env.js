
export default function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "GET method required"
        });
    }

    const variables = [
        "SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET"
    ];

    const results = variables.map(name => ({
        name,
        exists: Boolean(process.env[name]?.trim())
    }));

    const missing = results
        .filter(item => !item.exists)
        .map(item => item.name);

    return res.status(200).json({
        success: missing.length === 0,
        total: variables.length,
        configured: results.length - missing.length,
        missing_count: missing.length,
        variables: results,
        missing_variables: missing
    });

}
