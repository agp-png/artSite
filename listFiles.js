const { google } = require("googleapis");

async function listFilesInFolder() {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    try {
        const folderId = "1c8dZLqVqq7ycrBf6LYlthd0WSwF9nAVa";
        const response = await drive.files.list({
            // Files directly in this folder
            q: `'${folderId}' in parents`,
            fields: "files(id, name)",
        });

        if (response.data.files.length === 0) {
            console.log("No files found in the folder.");
        } else {
            response.data.files.forEach((file) => {
                console.log(`Name: ${file.name}, ID: ${file.id}`);
            });
        }
    } catch (error) {
        console.error("Error listing files:", error.message);
    }
}

listFilesInFolder().catch(console.error);
