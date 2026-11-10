
export default function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "GET method required"
        });
    }

    const variables = Object.keys(process.env).sort();

    const results = variables.map(name => ({
        name,
        type: typeof process.env[name],
        configured: Boolean(process.env[name]?.trim()),
        category: name.includes("SUPABASE")
            ? "Supabase"
            : name.includes("CLOUDINARY")
            ? "Cloudinary"
            : name.includes("VERCEL")
            ? "Vercel"
            : "Other"
    }));

    return res.status(200).json({
        success: true,
        total: results.length,
        variables: results
    });
}
